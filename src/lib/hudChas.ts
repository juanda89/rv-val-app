import fs from 'fs/promises';
import path from 'path';

type HudMetrics = {
    eliRenterHouseholds: number | null;
    unitsAffordable30: number | null;
    unitsPer100: number | null;
    totalUnits: number | null;
    twoBrRent: number | null;
};

let cachedData: Record<string, HudMetrics> | null = null;

const parseCsvLine = (line: string) => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (char === '"' && line[i + 1] === '"') {
            current += '"';
            i += 1;
            continue;
        }
        if (char === '"') {
            inQuotes = !inQuotes;
            continue;
        }
        if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
            continue;
        }
        current += char;
    }
    result.push(current);
    return result;
};

const toNumber = (value: string | undefined) => {
    if (!value) return null;
    const parsed = Number(String(value).replace(/[$,]/g, '').trim());
    return Number.isFinite(parsed) ? parsed : null;
};

const normalizeHeader = (value: string) =>
    value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');

const resolveIndex = (headers: string[], candidates: string[]) => {
    const normalized = headers.map(normalizeHeader);
    for (const candidate of candidates) {
        const target = normalizeHeader(candidate);
        const idx = normalized.indexOf(target);
        if (idx !== -1) return idx;
    }
    return -1;
};

const extractFips = (row: string[], headers: string[]) => {
    const geoidIndex = resolveIndex(headers, ['geoid']);
    const stateIndex = resolveIndex(headers, ['st', 'state']);
    const countyIndex = resolveIndex(headers, ['cnty', 'county']);
    const fipsIndex = resolveIndex(headers, ['fips', 'county_fips', 'fips_code']);

    const geoid = geoidIndex !== -1 ? row[geoidIndex] : '';
    const geoidMatch = geoid ? geoid.match(/(\\d{5})$/) : null;
    if (geoidMatch) return geoidMatch[1];

    const rawFips = fipsIndex !== -1 ? row[fipsIndex] : '';
    if (rawFips) return rawFips.trim().padStart(5, '0');

    const state = stateIndex !== -1 ? row[stateIndex] : '';
    const county = countyIndex !== -1 ? row[countyIndex] : '';
    if (state && county) {
        return `${state.trim().padStart(2, '0')}${county.trim().padStart(3, '0')}`;
    }

    return null;
};

const parseTable = async (filePath: string) => {
    const raw = await fs.readFile(filePath, 'utf-8');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return null;
    const headers = parseCsvLine(lines[0]);
    return { headers, lines };
};

const buildLookup = async () => {
    if (cachedData) return cachedData;

    const configuredPath = process.env.HUD_CHAS_CSV_PATH
        ? path.resolve(process.env.HUD_CHAS_CSV_PATH)
        : path.join(process.cwd(), '050');

    let stat: { isDirectory: () => boolean } | null = null;
    try {
        stat = await fs.stat(configuredPath);
    } catch (error) {
        return null;
    }

    const lookup: Record<string, HudMetrics> = {};

    const mergeMetric = (fips: string, partial: Partial<HudMetrics>) => {
        lookup[fips] = {
            eliRenterHouseholds: lookup[fips]?.eliRenterHouseholds ?? null,
            unitsAffordable30: lookup[fips]?.unitsAffordable30 ?? null,
            unitsPer100: lookup[fips]?.unitsPer100 ?? null,
            totalUnits: lookup[fips]?.totalUnits ?? null,
            twoBrRent: lookup[fips]?.twoBrRent ?? null,
            ...partial,
        };
    };

    if (stat.isDirectory()) {
        const table16Path = path.join(configuredPath, 'Table16.csv');
        const table15cPath = path.join(configuredPath, 'Table15C.csv');
        const optionalRentCsvs = [
            path.join(configuredPath, 'hud_rents.csv'),
            path.join(configuredPath, 'fmr.csv'),
            path.join(configuredPath, 'fmr_by_county.csv'),
            path.join(configuredPath, '2br_rent.csv'),
        ];

        let table16: { headers: string[]; lines: string[] } | null = null;
        let table15c: { headers: string[]; lines: string[] } | null = null;

        try {
            table16 = await parseTable(table16Path);
            table15c = await parseTable(table15cPath);
        } catch (error) {
            return null;
        }

        if (!table16 || !table15c) return null;

        const eliIndex = resolveIndex(table16.headers, ['T16_est88']);
        if (eliIndex !== -1) {
            for (let i = 1; i < table16.lines.length; i += 1) {
                const row = parseCsvLine(table16.lines[i]);
                const fips = extractFips(row, table16.headers);
                if (!fips) continue;
                const eli = toNumber(row[eliIndex]);
                mergeMetric(fips, { eliRenterHouseholds: eli });
            }
        }

        const unitsAffordableIndex = resolveIndex(table15c.headers, ['T15C_est4']);
        const totalUnitsIndex = resolveIndex(table15c.headers, ['T15C_est1']);
        for (let i = 1; i < table15c.lines.length; i += 1) {
            const row = parseCsvLine(table15c.lines[i]);
            const fips = extractFips(row, table15c.headers);
            if (!fips) continue;
            const unitsAffordable = unitsAffordableIndex !== -1 ? toNumber(row[unitsAffordableIndex]) : null;
            const totalUnits = totalUnitsIndex !== -1 ? toNumber(row[totalUnitsIndex]) : null;
            mergeMetric(fips, { unitsAffordable30: unitsAffordable, totalUnits });
        }

        for (const rentCsvPath of optionalRentCsvs) {
            try {
                const rentTable = await parseTable(rentCsvPath);
                if (!rentTable) continue;
                const fipsIndex = resolveIndex(rentTable.headers, ['fips', 'county_fips', 'fips_code', 'geoid']);
                const twoBrRentIndex = resolveIndex(rentTable.headers, [
                    'two_br_rent',
                    '2_br_rent',
                    'two_bedroom_rent',
                    'two_bedroom_fmr',
                    'fmr_2br',
                    'rent_2br',
                ]);
                if (fipsIndex === -1 || twoBrRentIndex === -1) continue;

                for (let i = 1; i < rentTable.lines.length; i += 1) {
                    const row = parseCsvLine(rentTable.lines[i]);
                    const rawFips = row[fipsIndex];
                    if (!rawFips) continue;
                    const fipsMatch = String(rawFips).match(/(\d{5})$/);
                    const fips = fipsMatch ? fipsMatch[1] : String(rawFips).trim().padStart(5, '0');
                    const twoBrRent = toNumber(row[twoBrRentIndex]);
                    mergeMetric(fips, { twoBrRent });
                }
            } catch (_error) {
                // Optional local HUD rent file; ignore when absent.
            }
        }
    } else {
        let raw: string;
        try {
            raw = await fs.readFile(configuredPath, 'utf-8');
        } catch (error) {
            return null;
        }

        const lines = raw.split(/\r?\n/).filter(Boolean);
        if (lines.length === 0) return null;

        const headers = parseCsvLine(lines[0]);
        const fipsIndex = resolveIndex(headers, ['fips', 'county_fips', 'fips_code']);
        const eliIndex = resolveIndex(headers, ['eli_renter_households', 'eli_renter_hh', 'eli_households']);
        const unitsIndex = resolveIndex(headers, ['units_affordable_at_30', 'units_affordable_30', 'units_affordable']);
        const unitsPer100Index = resolveIndex(headers, ['units_per_100', 'units_per_100_eli']);
        const totalUnitsIndex = resolveIndex(headers, ['total_units', 'total_housing_units']);
        const twoBrRentIndex = resolveIndex(headers, [
            'two_br_rent',
            '2_br_rent',
            'two_bedroom_rent',
            'two_bedroom_fmr',
            'fmr_2br',
            'rent_2br',
        ]);

        if (fipsIndex === -1) return null;

        for (let i = 1; i < lines.length; i += 1) {
            const row = parseCsvLine(lines[i]);
            const rawFips = row[fipsIndex];
            if (!rawFips) continue;
            const fips = rawFips.trim().padStart(5, '0');
            const eli = toNumber(row[eliIndex]);
            const unitsAffordable = toNumber(row[unitsIndex]);
            const totalUnits = toNumber(row[totalUnitsIndex]);
            const twoBrRent = toNumber(row[twoBrRentIndex]);
            const unitsPer100 = toNumber(row[unitsPer100Index]) ??
                (eli && unitsAffordable ? Number(((unitsAffordable / eli) * 100).toFixed(2)) : null);

            lookup[fips] = {
                eliRenterHouseholds: eli,
                unitsAffordable30: unitsAffordable,
                unitsPer100,
                totalUnits,
                twoBrRent,
            };
        }
    }

    for (const [fips, metrics] of Object.entries(lookup)) {
        if (metrics.unitsPer100 === null && metrics.eliRenterHouseholds && metrics.unitsAffordable30) {
            lookup[fips] = {
                ...metrics,
                unitsPer100: Number(((metrics.unitsAffordable30 / metrics.eliRenterHouseholds) * 100).toFixed(2)),
            };
        }
    }

    cachedData = lookup;
    return cachedData;
};

export const lookupHudChas = async (fipsCode: string | null) => {
    if (!fipsCode) return null;
    const normalizedFips = String(fipsCode).padStart(5, '0');
    const lookup = await buildLookup();
    if (!lookup) return null;
    return lookup[normalizedFips] || null;
};

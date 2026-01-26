import { NextResponse } from 'next/server';
import { lookupHudChas } from '@/lib/hudChas';

export const runtime = 'nodejs';

type PropertySelectionContext = {
    address?: string;
    normalizedAddress?: string;
    lat?: number;
    lng?: number;
    apiKey?: string | null;
};

type PropertyCandidate = {
    index: number;
    address: string | null;
    line1: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    apn: string | null;
    attomId: string | null;
    propertyType: string | null;
    latitude: number | null;
    longitude: number | null;
};

const ATTOM_BASIC_ENDPOINT = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/basicprofile';
const ATTOM_DETAIL_ENDPOINT = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detail';
const ATTOM_SNAPSHOT_ENDPOINT = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/snapshot';
const ATTOM_EXPANDED_ENDPOINT = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/expandedprofile';
const ATTOM_COMMUNITY_ENDPOINT = 'https://api.gateway.attomdata.com/v4/neighborhood/community';
const ATTOM_LOCATION_LOOKUP_ENDPOINT = 'https://api.gateway.attomdata.com/v4/location/lookup';
const TREASURY_YIELD_XML_URL = 'https://home.treasury.gov/sites/default/files/interest-rates/yield.xml';
const TREASURY_YIELD_YEAR_URL = (year: number) =>
    `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=${year}`;

const normalizeAddress = (value: string) =>
    value.replace(/,?\s*USA$/i, '').replace(/\s+/g, ' ').trim();

const toNumber = (value: unknown) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(String(value).replace(/[$,]/g, '').trim());
    return Number.isFinite(parsed) ? parsed : null;
};

const toPercent = (value: number | null) => {
    if (value === null) return null;
    return value > 1 ? Number(value.toFixed(2)) : Number((value * 100).toFixed(2));
};

const pickNumber = (...values: Array<unknown>) => {
    for (const value of values) {
        const parsed = toNumber(value);
        if (parsed !== null) return parsed;
    }
    return null;
};

const avgNumbers = (...values: Array<number | null>) => {
    const nums = values.filter((value): value is number => value !== null && Number.isFinite(value));
    if (nums.length === 0) return null;
    return Number((nums.reduce((sum, value) => sum + value, 0) / nums.length).toFixed(2));
};

const getYearValue = (item: Record<string, any>) =>
    item?.tax?.taxYear ?? item?.taxYear ?? item?.assessmentYear ?? item?.year ?? null;

const normalizeYearItems = (items?: any[] | Record<string, any>) => {
    if (!items) return [];
    if (Array.isArray(items)) return items;
    if (typeof items !== 'object') return [];

    return Object.entries(items).map(([key, value]) => {
        if (value && typeof value === 'object' && getYearValue(value) === null) {
            const parsedYear = Number(key);
            return Number.isFinite(parsedYear) ? { ...value, year: parsedYear } : value;
        }
        return value;
    });
};

const getSortedByYear = (items?: any[] | Record<string, any>) => {
    const normalized = normalizeYearItems(items);
    if (normalized.length === 0) return [];
    return [...normalized].sort((a, b) => {
        const aYear = getYearValue(a) ?? 0;
        const bYear = getYearValue(b) ?? 0;
        return bYear - aYear;
    });
};

const getLatestByYear = (items?: any[] | Record<string, any>) => getSortedByYear(items)[0] || null;

const getPreviousByYear = (items?: any[] | Record<string, any>) => getSortedByYear(items)[1] || null;

const extractXmlTagValue = (chunk: string, tagNames: string[]) => {
    for (const tag of tagNames) {
        const regex = new RegExp(`<(?:d:)?${tag}[^>]*>([^<]+)<\\/` + `(?:d:)?${tag}>`, 'i');
        const match = chunk.match(regex);
        if (match?.[1]) return match[1].trim();
    }
    return null;
};

const parseTreasuryYieldXml = (xml: string) => {
    const entryRegex = /<entry\b[^>]*>[\s\S]*?<\/entry>/gi;
    const entries = xml.match(entryRegex) || [];
    if (entries.length === 0) return null;

    const dateTags = ['NEW_DATE', 'record_date', 'DATE', 'date'];
    const rateTags = ['BC_10YEAR', 'BC_10Y', 'BC_10YR'];

    let latestDate: Date | null = null;
    let latestRate: number | null = null;

    for (const entry of entries) {
        const dateValue = extractXmlTagValue(entry, dateTags);
        const rateValue = extractXmlTagValue(entry, rateTags);
        if (!dateValue || !rateValue) continue;
        const parsedDate = new Date(dateValue);
        const parsedRate = Number(rateValue);
        if (!Number.isFinite(parsedRate) || Number.isNaN(parsedDate.valueOf())) continue;
        if (!latestDate || parsedDate > latestDate) {
            latestDate = parsedDate;
            latestRate = parsedRate;
        }
    }

    return latestRate !== null
        ? { date: latestDate?.toISOString().slice(0, 10) ?? null, rate: latestRate }
        : null;
};

const fetchTreasury10YearYield = async () => {
    const tryFetch = async (url: string) => {
        const response = await fetch(url);
        if (!response.ok) return null;
        const xml = await response.text();
        return parseTreasuryYieldXml(xml);
    };

    const fromDaily = await tryFetch(TREASURY_YIELD_XML_URL);
    if (fromDaily?.rate !== null && fromDaily?.rate !== undefined) return fromDaily;

    const year = new Date().getFullYear();
    return tryFetch(TREASURY_YIELD_YEAR_URL(year));
};

const toAcres = (lotSizeSqft: number | null) => {
    if (!lotSizeSqft) return null;
    return Number((lotSizeSqft / 43560).toFixed(2));
};

const extractFips = (property: Record<string, any>) => {
    const candidates = [
        property?.area?.county?.fips,
        property?.area?.county?.fipsCode,
        property?.area?.county?.fipsCodeFull,
        property?.area?.county?.geoId,
        property?.area?.census?.geoid,
        property?.area?.census?.fips,
        property?.identifier?.fips,
        property?.identifier?.fipsCode,
        property?.identifier?.countyFips,
        property?.identifier?.fipsCounty,
    ];
    for (const candidate of candidates) {
        if (candidate) {
            return String(candidate).padStart(5, '0');
        }
    }
    return null;
};

const STATE_FIPS: Record<string, string> = {
    AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09', DE: '10', DC: '11',
    FL: '12', GA: '13', HI: '15', ID: '16', IL: '17', IN: '18', IA: '19', KS: '20', KY: '21',
    LA: '22', ME: '23', MD: '24', MA: '25', MI: '26', MN: '27', MS: '28', MO: '29', MT: '30',
    NE: '31', NV: '32', NH: '33', NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38', OH: '39',
    OK: '40', OR: '41', PA: '42', RI: '44', SC: '45', SD: '46', TN: '47', TX: '48', UT: '49',
    VT: '50', VA: '51', WA: '53', WV: '54', WI: '55', WY: '56',
};

const normalizeCountyName = (value: string) =>
    value
        .toLowerCase()
        .replace(/\s+county$/i, '')
        .replace(/\s+parish$/i, '')
        .replace(/\s+borough$/i, '')
        .replace(/\s+census\s+area$/i, '')
        .replace(/\s+municipality$/i, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

const fetchCountyFips = async (state: string | null, county: string | null) => {
    if (!state || !county) return null;
    const stateCode = STATE_FIPS[state.toUpperCase()];
    if (!stateCode) return null;
    const params = new URLSearchParams();
    params.set('get', 'NAME');
    params.set('for', 'county:*');
    params.set('in', `state:${stateCode}`);
    if (process.env.CENSUS_API_KEY) {
        params.set('key', process.env.CENSUS_API_KEY);
    }
    const response = await fetch(`https://api.census.gov/data/2022/acs/acs5?${params.toString()}`);
    if (!response.ok) return null;
    const payload = await response.json();
    const rows = Array.isArray(payload) ? payload.slice(1) : [];
    const target = normalizeCountyName(county);
    for (const row of rows) {
        const name = String(row?.[0] ?? '');
        const countyFips = String(row?.[2] ?? '').padStart(3, '0');
        if (!name || !countyFips) continue;
        const normalized = normalizeCountyName(name);
        if (normalized === target) {
            return `${stateCode}${countyFips}`;
        }
    }
    return null;
};

const calculatePercentChange = (current: number | null, previous: number | null) => {
    if (current === null || previous === null || previous === 0) return null;
    return Number((((current - previous) / previous) * 100).toFixed(2));
};

const splitAddress = (value: string) => {
    const normalized = normalizeAddress(value);
    const parts = normalized
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);

    if (parts.length >= 2) {
        return {
            address1: parts[0],
            address2: parts.slice(1).join(' '),
        };
    }

    const match = normalized.match(/^(.*)\s+([A-Za-z\\s]+)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
    if (match) {
        return {
            address1: match[1].trim(),
            address2: `${match[2].trim()} ${match[3]} ${match[4]}`,
        };
    }

    return {
        address1: normalized,
        address2: '',
    };
};

const extractProperties = (payload: any) => {
    const candidates =
        payload?.property ||
        payload?.properties ||
        payload?.Property ||
        payload?.Properties ||
        null;
    if (Array.isArray(candidates)) return candidates.filter(Boolean);
    if (candidates && typeof candidates === 'object') return [candidates];
    return [];
};

const getPropertyAddressParts = (property: Record<string, any>) => {
    const addressData = property?.address || {};
    return {
        line1: addressData?.line1 || addressData?.address1 || addressData?.street || '',
        city: addressData?.locality || addressData?.city || '',
        state: addressData?.countrySubd || addressData?.state || '',
        zip: addressData?.postal1 || addressData?.zip || '',
    };
};

const formatAddressParts = (parts: { line1?: string; city?: string; state?: string; zip?: string }) =>
    [parts.line1, parts.city, parts.state, parts.zip].filter(Boolean).join(', ').trim();

const normalizeMatchValue = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]/g, '');

const scoreCandidateMatch = (candidate: PropertyCandidate, target: string) => {
    if (!target) return 0;
    const address = candidate.address || '';
    if (!address) return 0;
    const normalizedTarget = normalizeMatchValue(target);
    const normalizedAddress = normalizeMatchValue(address);
    if (!normalizedTarget || !normalizedAddress) return 0;

    let score = 0;
    if (normalizedAddress === normalizedTarget) score += 100;
    if (normalizedAddress.includes(normalizedTarget) || normalizedTarget.includes(normalizedAddress)) score += 50;

    const targetZip = target.match(/\b\d{5}(?:-\d{4})?\b/)?.[0];
    if (targetZip && candidate.zip && candidate.zip.startsWith(targetZip.slice(0, 5))) score += 10;

    const targetNumber = target.match(/\d+/)?.[0];
    if (targetNumber && address.includes(targetNumber)) score += 5;

    if (candidate.state && target.toLowerCase().includes(candidate.state.toLowerCase())) score += 5;
    if (candidate.city && target.toLowerCase().includes(candidate.city.toLowerCase())) score += 5;

    return score;
};

const pickBestCandidateIndex = (candidates: PropertyCandidate[], context: PropertySelectionContext) => {
    const target = context.address || context.normalizedAddress || '';
    if (!target) return 0;

    let bestIndex = 0;
    let bestScore = -1;

    for (const candidate of candidates) {
        const score = scoreCandidateMatch(candidate, target);
        if (score > bestScore) {
            bestScore = score;
            bestIndex = candidate.index;
        }
    }

    return bestIndex;
};

const summarizePropertyCandidate = (property: Record<string, any>, index: number): PropertyCandidate => {
    const parts = getPropertyAddressParts(property);
    const summary = property?.summary || {};
    const attomId =
        property?.identifier?.attomId ||
        property?.identifier?.attomid ||
        property?.attomId ||
        property?.attomid ||
        null;
    const apn =
        property?.identifier?.apn ||
        property?.identifier?.apnOrig ||
        property?.identifier?.parcelId ||
        null;
    const latitude =
        property?.location?.latitude ||
        property?.location?.lat ||
        property?.address?.latitude ||
        property?.address?.lat ||
        null;
    const longitude =
        property?.location?.longitude ||
        property?.location?.lng ||
        property?.address?.longitude ||
        property?.address?.lng ||
        null;

    return {
        index,
        address: formatAddressParts(parts) || null,
        line1: parts.line1 || null,
        city: parts.city || null,
        state: parts.state || null,
        zip: parts.zip || null,
        apn,
        attomId,
        propertyType: summary?.propclass || summary?.propType || summary?.propertyType || null,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
    };
};

const buildPropertySelectionPrompt = (context: PropertySelectionContext, candidates: PropertyCandidate[]) => {
    const targetAddress = context.address || '';
    const normalized = context.normalizedAddress || '';
    const lat = context.lat ?? null;
    const lng = context.lng ?? null;

    return `
You are selecting the single best matching property from ATTOM results.

Target:
- address: ${targetAddress}
- normalized_address: ${normalized}
- latitude: ${lat}
- longitude: ${lng}

Candidates (JSON array):
${JSON.stringify(candidates)}

Return ONLY JSON: {"index": number}
Choose the closest match if unsure.
`;
};

const callGeminiSelection = async (apiKey: string, prompt: string) => {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-latest:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0,
                    response_mime_type: 'application/json',
                },
            }),
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini request failed: ${errorText}`);
    }

    const json = await response.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text || typeof text !== 'string') {
        throw new Error('Gemini returned no content');
    }

    return JSON.parse(text);
};

const selectBestProperty = async (
    properties: Record<string, any>[],
    context: PropertySelectionContext
) => {
    if (properties.length === 0) return null;
    if (properties.length === 1) return properties[0];
    if (!context.apiKey) {
        throw new Error('Missing GEMINI_API_KEY');
    }

    const candidates = properties.map((property, index) => summarizePropertyCandidate(property, index));

    try {
        const prompt = buildPropertySelectionPrompt(context, candidates);
        const selection = await callGeminiSelection(context.apiKey, prompt);
        const index = Number(selection?.index);
        if (Number.isInteger(index) && index >= 0 && index < properties.length) {
            return properties[index];
        }
    } catch (error) {
        console.warn('Gemini property selection failed:', error);
    }

    const fallbackIndex = pickBestCandidateIndex(candidates, context);
    return properties[fallbackIndex] || properties[0];
};

const findGeoIdV4 = (payload: any, maxDepth = 4) => {
    const visited = new Set<any>();
    const queue: Array<{ value: any; depth: number }> = [{ value: payload, depth: 0 }];

    while (queue.length) {
        const current = queue.shift();
        if (!current) continue;
        const { value, depth } = current;
        if (!value || typeof value !== 'object' || visited.has(value)) continue;
        visited.add(value);

        for (const [key, val] of Object.entries(value)) {
            if (key.toLowerCase() === 'geoidv4' && typeof val === 'string' && val.trim()) {
                return val.trim();
            }
            if (depth < maxDepth && val && typeof val === 'object') {
                queue.push({ value: val, depth: depth + 1 });
            }
        }
    }
    return null;
};

const findGeoIdFromLocationLookup = (payload: any, preferredType?: string) => {
    const candidates =
        payload?.location ||
        payload?.locations ||
        payload?.Location ||
        payload?.Locations ||
        payload?.result ||
        payload?.results ||
        payload?.data ||
        null;

    const list = Array.isArray(candidates)
        ? candidates
        : candidates && typeof candidates === 'object'
            ? Object.values(candidates)
            : [];

    if (list.length === 0) {
        return findGeoIdV4(payload);
    }

    const normalizedPreferred = preferredType ? preferredType.toLowerCase() : '';
    const matched = list.find((item: any) => {
        const type = String(item?.geographyTypeName || item?.type || item?.locationType || '').toLowerCase();
        return normalizedPreferred && type.includes(normalizedPreferred) && item?.geoIdV4;
    });
    if (matched?.geoIdV4) return String(matched.geoIdV4);

    for (const item of list) {
        if (item?.geoIdV4) return String(item.geoIdV4);
    }

    return findGeoIdV4(payload);
};

const extractAddressLines = (property: Record<string, any>, fallbackAddress: string) => {
    const addressData = property?.address || {};
    const line1 =
        addressData?.line1 ||
        addressData?.address1 ||
        addressData?.street ||
        '';
    const city = addressData?.locality || addressData?.city || '';
    const state = addressData?.countrySubd || addressData?.state || '';
    const zip = addressData?.postal1 || addressData?.zip || '';

    if (line1 && (city || state || zip)) {
        return {
            address1: line1,
            address2: [city, state, zip].filter(Boolean).join(' ').trim(),
        };
    }

    if (fallbackAddress) {
        return splitAddress(fallbackAddress);
    }

    return { address1: line1 || fallbackAddress || '', address2: '' };
};

const fetchCensusMetrics = async (fipsCode: string, year: number) => {
    const stateFips = fipsCode.slice(0, 2);
    const countyFips = fipsCode.slice(2);
    if (!stateFips || !countyFips) return null;

    const params = new URLSearchParams();
    params.set('get', 'NAME,B01003_001E,B19013_001E,B17001_002E,B23025_004E,B25077_001E,B25031_003E');
    params.set('for', `county:${countyFips}`);
    params.set('in', `state:${stateFips}`);
    if (process.env.CENSUS_API_KEY) {
        params.set('key', process.env.CENSUS_API_KEY);
    }
    const response = await fetch(`https://api.census.gov/data/${year}/acs/acs5?${params.toString()}`);
    if (!response.ok) return null;
    const payload = await response.json();
    const row = payload?.[1];
    if (!row) return null;

    return {
        population: toNumber(row[1]),
        medianHouseholdIncome: toNumber(row[2]),
        povertyCount: toNumber(row[3]),
        employed: toNumber(row[4]),
        medianPropertyValue: toNumber(row[5]),
        twoBrRent: toNumber(row[6]),
    };
};

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const address = body?.address;
        const lat = body?.lat;
        const lng = body?.lng;
        const apnRaw = body?.apn || body?.parcelNumber || body?.parcel_1;
        const fipsRaw = body?.fips || body?.fips_code;
        const apn =
            apnRaw === null || apnRaw === undefined
                ? null
                : String(apnRaw).trim().replace(/\s+/g, '');
        const fips =
            fipsRaw === null || fipsRaw === undefined
                ? null
                : String(fipsRaw).trim().replace(/\s+/g, '');
        if (!address && (lat === undefined || lng === undefined) && !(apn && fips)) {
            return NextResponse.json({ error: 'Missing address or parcel info' }, { status: 400 });
        }

        const apiKey = process.env.ATTOM_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Missing ATTOM_API_KEY' }, { status: 500 });
        }
        const geminiApiKey = process.env.GEMINI_API_KEY;

        const fetchBasic = async (rawAddress: string) => {
            const { address1, address2 } = splitAddress(rawAddress);
            const params = new URLSearchParams();
            params.set('address1', address1);
            if (address2) params.set('address2', address2);
            const response = await fetch(`${ATTOM_BASIC_ENDPOINT}?${params.toString()}`, {
                headers: {
                    apikey: apiKey,
                    Accept: 'application/json',
                },
            });
            const payload = await response.json();
            return { response, payload };
        };

        const fetchSnapshotByGeo = async (latitude: number, longitude: number) => {
            const params = new URLSearchParams();
            params.set('latitude', String(latitude));
            params.set('longitude', String(longitude));
            params.set('radius', '2');
            const response = await fetch(`${ATTOM_SNAPSHOT_ENDPOINT}?${params.toString()}`, {
                headers: {
                    apikey: apiKey,
                    Accept: 'application/json',
                },
            });
            const payload = await response.json();
            return { response, payload };
        };

        const fetchExpandedByParcel = async (apn: string, fips: string) => {
            const params = new URLSearchParams();
            params.set('apn', apn);
            params.set('fips', fips);
            const response = await fetch(`${ATTOM_EXPANDED_ENDPOINT}?${params.toString()}`, {
                headers: {
                    apikey: apiKey,
                    Accept: 'application/json',
                },
            });
            const payload = await response.json();
            return { response, payload };
        };

        const normalizedAddress = address ? normalizeAddress(String(address)) : '';
        const selectionContext: PropertySelectionContext = {
            address: address ? String(address) : undefined,
            normalizedAddress: normalizedAddress || undefined,
            lat: lat !== undefined ? Number(lat) : undefined,
            lng: lng !== undefined ? Number(lng) : undefined,
            apiKey: geminiApiKey,
        };
        let response: Response | null = null;
        let payload: any = null;
        let property: any = null;
        let source = 'address';

        if (apn && fips) {
            const parcelResponse = await fetchExpandedByParcel(apn, fips);
            if (parcelResponse.response.ok) {
                payload = parcelResponse.payload;
                response = parcelResponse.response;
                property = await selectBestProperty(extractProperties(payload), selectionContext);
                if (property) {
                    source = 'parcel_fips';
                }
            } else if (!address && (lat === undefined || lng === undefined)) {
                response = parcelResponse.response;
                payload = parcelResponse.payload;
            }
        }

        if (!property && address) {
            const primary = await fetchBasic(String(address));
            response = primary.response;
            payload = primary.payload;
            property = await selectBestProperty(extractProperties(payload), selectionContext);

            if ((response.ok && !property) || (!response.ok && normalizedAddress && normalizedAddress !== address)) {
                if (normalizedAddress && normalizedAddress !== address) {
                    const fallback = await fetchBasic(normalizedAddress);
                    response = fallback.response;
                    payload = fallback.payload;
                    const fallbackContext: PropertySelectionContext = {
                        ...selectionContext,
                        address: normalizedAddress,
                        normalizedAddress,
                    };
                    property = await selectBestProperty(extractProperties(payload), fallbackContext);
                    source = 'normalized_address';
                }
            }
        }

        if (!property && lat !== undefined && lng !== undefined) {
            const geoFallback = await fetchSnapshotByGeo(Number(lat), Number(lng));
            response = geoFallback.response;
            payload = geoFallback.payload;
            property = await selectBestProperty(extractProperties(payload), selectionContext);
            source = 'geo_snapshot';
        }

        if (response && !response.ok) {
            return NextResponse.json(
                { error: payload?.message || payload?.status?.msg || 'ATTOM request failed' },
                { status: response.status }
            );
        }

        if (!property) {
            return NextResponse.json({ error: 'No property data found', found: false }, { status: 404 });
        }

        const attomId =
            property?.identifier?.attomId ||
            property?.identifier?.attomid ||
            property?.attomId ||
            property?.attomid ||
            null;

        if (attomId) {
            const detailResponse = await fetch(`${ATTOM_DETAIL_ENDPOINT}?attomid=${attomId}`, {
                headers: {
                    apikey: apiKey,
                    Accept: 'application/json',
                },
            });
            if (detailResponse.ok) {
                const detailPayload = await detailResponse.json();
                const detailProperty = await selectBestProperty(
                    extractProperties(detailPayload),
                    selectionContext
                );
                if (detailProperty) {
                    property = {
                        ...property,
                        ...detailProperty,
                        address: {
                            ...(property?.address || {}),
                            ...(detailProperty?.address || {}),
                        },
                        summary: {
                            ...(property?.summary || {}),
                            ...(detailProperty?.summary || {}),
                        },
                        lot: {
                            ...(property?.lot || {}),
                            ...(detailProperty?.lot || {}),
                        },
                    };
                }
            }
        }

        const { address1, address2 } = extractAddressLines(property, normalizedAddress || String(address || ''));
        if (address1) {
            const expandedParams = new URLSearchParams();
            expandedParams.set('address1', address1);
            if (address2) expandedParams.set('address2', address2);
            const expandedResponse = await fetch(`${ATTOM_EXPANDED_ENDPOINT}?${expandedParams.toString()}`, {
                headers: {
                    apikey: apiKey,
                    Accept: 'application/json',
                },
            });
            if (expandedResponse.ok) {
                const expandedPayload = await expandedResponse.json();
                const expandedProperty = await selectBestProperty(
                    extractProperties(expandedPayload),
                    selectionContext
                );
                if (expandedProperty) {
                    property = {
                        ...property,
                        ...expandedProperty,
                        address: {
                            ...(property?.address || {}),
                            ...(expandedProperty?.address || {}),
                        },
                        summary: {
                            ...(property?.summary || {}),
                            ...(expandedProperty?.summary || {}),
                        },
                        lot: {
                            ...(property?.lot || {}),
                            ...(expandedProperty?.lot || {}),
                        },
                        assessment: expandedProperty?.assessment || property?.assessment,
                        tax: expandedProperty?.tax || property?.tax,
                    };
                }
            }
        }

        const lookupAddressData = property?.address || {};
        const lookupState = lookupAddressData?.countrySubd || lookupAddressData?.state || '';
        const lookupCounty =
            property?.area?.county?.name ||
            property?.area?.countyname ||
            property?.area?.countrySec?.name ||
            property?.area?.countrySecondary?.name ||
            null;

        let fipsCode = extractFips(property);
        if (!fipsCode) {
            fipsCode = await fetchCountyFips(lookupState, lookupCounty);
        }

        const propertyApn =
            property?.identifier?.apn ||
            property?.identifier?.apnOrig ||
            property?.identifier?.parcelId ||
            null;

        if (propertyApn && fipsCode) {
            const parcelResponse = await fetchExpandedByParcel(String(propertyApn).trim(), String(fipsCode).trim());
            if (parcelResponse.response.ok) {
                const parcelProperty = await selectBestProperty(
                    extractProperties(parcelResponse.payload),
                    selectionContext
                );
                if (parcelProperty) {
                    property = {
                        ...property,
                        ...parcelProperty,
                        address: {
                            ...(property?.address || {}),
                            ...(parcelProperty?.address || {}),
                        },
                        summary: {
                            ...(property?.summary || {}),
                            ...(parcelProperty?.summary || {}),
                        },
                        lot: {
                            ...(property?.lot || {}),
                            ...(parcelProperty?.lot || {}),
                        },
                        assessment: parcelProperty?.assessment || property?.assessment,
                        tax: parcelProperty?.tax || property?.tax,
                    };
                }
            }
        }

        fipsCode = extractFips(property) || fipsCode;

        const addressData = property?.address || {};
        const summary = property?.summary || {};
        const lot = property?.lot || {};
        const sale = property?.sale || {};
        const assessmentItems = property?.assessment || property?.assessmentHistory || property?.assessments;
        const taxItems = property?.tax || property?.taxHistory || property?.taxes;

        const lotSizeSqft = pickNumber(
            lot?.lotSize1?.size,
            lot?.lotSize2?.size,
            lot?.lotSize?.size,
            lot?.lotSize1,
            lot?.lotSize2,
            summary?.lotsize1,
            summary?.lotsize2
        );
        const acres = toAcres(lotSizeSqft);
        const propertyType = summary?.propclass || summary?.propType || summary?.propertyType || null;
        const yearBuilt = summary?.yearbuilt || summary?.yearBuilt || null;

        const latestAssessment = getLatestByYear(assessmentItems);
        const latestTax = getLatestByYear(taxItems);
        const previousTax = getPreviousByYear(taxItems);

        const assessedValue = pickNumber(
            latestAssessment?.assessed?.value,
            latestAssessment?.assessed?.total,
            latestAssessment?.assessed?.valueTotal,
            latestAssessment?.assessed?.assdTtlValue,
            latestAssessment?.assessed?.assdImprValue,
            latestAssessment?.assessed?.assdLandValue,
            latestAssessment?.assessedValue,
            latestAssessment?.totalAssessedValue,
            latestAssessment?.value,
            property?.assessment?.assessed?.value,
            property?.assessment?.assessed?.assdTtlValue,
            property?.assessment?.assessed?.assdImprValue,
            property?.assessment?.assessed?.assdLandValue,
            property?.assessment?.assessedValue
        );

        const taxAmount = pickNumber(
            latestTax?.tax?.amount?.total,
            latestTax?.tax?.taxAmount,
            latestTax?.tax?.taxAmt,
            latestTax?.taxAmount,
            latestTax?.amount?.total,
            latestTax?.amount,
            property?.tax?.amount?.total,
            property?.tax?.taxAmount,
            property?.assessment?.tax?.taxAmt,
            property?.assessment?.tax?.taxAmount
        );

        const previousTaxAmount = pickNumber(
            previousTax?.tax?.amount?.total,
            previousTax?.tax?.taxAmount,
            previousTax?.tax?.taxAmt,
            previousTax?.taxAmount,
            previousTax?.amount?.total,
            previousTax?.amount
        );

        const taxYear = getYearValue(latestTax)
            ?? latestTax?.tax?.taxYear
            ?? latestTax?.taxYear
            ?? property?.assessment?.tax?.taxYear
            ?? property?.assessment?.tax?.taxyear
            ?? getYearValue(latestAssessment);

        const millageRate =
            taxAmount !== null && assessedValue !== null && assessedValue !== 0
                ? Number(((taxAmount / assessedValue) * 1000).toFixed(3))
                : null;

        const lastSalePrice = pickNumber(
            sale?.amount?.salePrice,
            sale?.saleAmount,
            sale?.price,
            property?.sale?.amount?.salePrice
        );

        const marketValue = pickNumber(
            latestAssessment?.market?.value,
            latestAssessment?.marketValue,
            latestAssessment?.market?.total,
            latestAssessment?.market?.valueTotal,
            latestAssessment?.market?.mktTtlValue,
            latestAssessment?.market?.mktImprValue,
            latestAssessment?.market?.mktLandValue,
            property?.assessment?.market?.value,
            property?.assessment?.marketValue,
            property?.assessment?.market?.total,
            property?.assessment?.market?.valueTotal,
            property?.assessment?.market?.mktTtlValue,
            property?.assessment?.market?.mktImprValue,
            property?.assessment?.market?.mktLandValue
        );

        const assessmentRatio =
            assessedValue !== null && marketValue !== null && marketValue !== 0
                ? Number((assessedValue / marketValue).toFixed(3))
                : assessedValue !== null && lastSalePrice !== null && lastSalePrice !== 0
                    ? Number((assessedValue / lastSalePrice).toFixed(3))
                    : null;

        const addressLine1 = addressData?.line1 || addressData?.address1 || addressData?.street || '';
        const city = addressData?.locality || addressData?.city || '';
        const state = addressData?.countrySubd || addressData?.state || '';
        const zip = addressData?.postal1 || addressData?.zip || '';
        const oneLine =
            addressData?.oneLine ||
            [addressLine1, city, state, zip].filter(Boolean).join(', ');

        const county =
            property?.area?.county?.name ||
            property?.area?.countyname ||
            property?.area?.countrySec?.name ||
            property?.area?.countrySecondary?.name ||
            null;

        let geoIdV4 = findGeoIdV4(payload) ?? findGeoIdV4(property);
        let community: any = null;

        const fetchCommunity = async (geoId: string) => {
            const communityResponse = await fetch(`${ATTOM_COMMUNITY_ENDPOINT}?geoIdV4=${geoId}`, {
                headers: {
                    apikey: apiKey,
                    Accept: 'application/json',
                },
            });
            if (!communityResponse.ok) return null;
            return communityResponse.json();
        };

        if (geoIdV4) {
            community = await fetchCommunity(geoIdV4);
        }

        if (!geoIdV4 || !community?.community?.demographics) {
            const locationName = [county, state].filter(Boolean).join(', ');
            const fallbackName = locationName || [city, state].filter(Boolean).join(', ');
            if (fallbackName) {
                const lookupParams = new URLSearchParams();
                lookupParams.set('name', fallbackName);
                const lookupResponse = await fetch(`${ATTOM_LOCATION_LOOKUP_ENDPOINT}?${lookupParams.toString()}`, {
                    headers: {
                        apikey: apiKey,
                        Accept: 'application/json',
                    },
                });
                if (lookupResponse.ok) {
                    const lookupPayload = await lookupResponse.json();
                    const lookupGeoId = findGeoIdFromLocationLookup(lookupPayload, county ? 'county' : undefined);
                    if (lookupGeoId) {
                        geoIdV4 = lookupGeoId;
                        community = await fetchCommunity(lookupGeoId);
                    }
                }
            }
        }

        const communityDemo = community?.community?.demographics || {};
        const communityCrime = community?.community?.crime || {};

        const communityPopulation = pickNumber(
            communityDemo?.population,
            communityDemo?.population_2020,
            communityDemo?.population_2010,
            communityDemo?.population_2000
        );
        const communityPopulationChange = pickNumber(
            communityDemo?.population_Chg_Pct_2020,
            communityDemo?.population_Chg_Pct_2010,
            communityDemo?.population_Chg_Pct_2000,
            communityDemo?.population_Chg_Pct_5_Yr_Projection
        );
        const communityMedianIncome = pickNumber(communityDemo?.median_Household_Income);
        const communityPovertyRate = pickNumber(
            communityDemo?.population_In_Poverty_Pct,
            communityDemo?.population_In_Poverty
        );
        const communityEmployees = pickNumber(
            communityDemo?.employee_Naics_Cnt,
            communityDemo?.population_Employed_16P
        );
        const communityMedianPropertyValue = pickNumber(
            communityDemo?.housing_Owner_Households_Median_Value
        );
        const communityTwoBrRent = pickNumber(
            communityDemo?.housing_Median_Rent,
            communityDemo?.housing_Median_Rent
        );
        const communityViolentCrime = pickNumber(communityCrime?.aggravated_Assault_Index)
            ?? pickNumber(
                communityCrime?.violentCrime_Index,
                communityCrime?.violent_Crime_Index,
                communityCrime?.violentCrime,
                communityCrime?.violent_crime
            )
            ?? avgNumbers(
                pickNumber(communityCrime?.murder_Index),
                pickNumber(communityCrime?.forcible_Rape_Index),
                pickNumber(communityCrime?.forcible_Robbery_Index),
                pickNumber(communityCrime?.aggravated_Assault_Index)
            );
        const communityPropertyCrime = pickNumber(communityCrime?.motor_Vehicle_Theft_Index)
            ?? pickNumber(
                communityCrime?.propertyCrime_Index,
                communityCrime?.property_Crime_Index,
                communityCrime?.propertyCrime,
                communityCrime?.property_crime
            )
            ?? avgNumbers(
                pickNumber(communityCrime?.burglary_Index),
                pickNumber(communityCrime?.larceny_Index),
                pickNumber(communityCrime?.motor_Vehicle_Theft_Index)
            );

        const attomPopulation = pickNumber(
            property?.demographics?.population,
            property?.demographics?.population?.total,
            property?.demographics?.population?.population,
            property?.area?.census?.population,
            property?.area?.census?.pop,
            property?.area?.census?.totpop
        );

        const attomPopulationChange = pickNumber(
            property?.demographics?.population?.change,
            property?.demographics?.populationChange,
            property?.area?.census?.populationChange,
            property?.area?.census?.popchg
        );

        const attomMedianIncome = pickNumber(
            property?.demographics?.income?.median,
            property?.demographics?.income?.medianHouseholdIncome,
            property?.area?.census?.medianIncome,
            property?.area?.census?.medincome
        );

        const attomMedianIncomeChange = pickNumber(
            property?.demographics?.income?.medianChange,
            property?.demographics?.income?.medianHouseholdIncomeChange,
            property?.area?.census?.medianIncomeChange,
            property?.area?.census?.medincomechange
        );

        const attomPovertyRate = pickNumber(
            property?.demographics?.poverty?.rate,
            property?.demographics?.povertyRate,
            property?.area?.census?.povertyRate
        );

        const attomEmployees = pickNumber(
            property?.demographics?.employment?.employed,
            property?.demographics?.employment?.employees,
            property?.area?.census?.employment,
            property?.area?.census?.employed
        );

        const attomEmployeesChange = pickNumber(
            property?.demographics?.employment?.change,
            property?.demographics?.employmentChange,
            property?.area?.census?.employmentChange
        );

        const attomMedianPropertyValue = pickNumber(
            property?.demographics?.homeValue?.median,
            property?.demographics?.homeValue?.medianValue,
            property?.area?.census?.medianHomeValue,
            property?.area?.census?.medhomevalue
        );

        const attomMedianPropertyValueChange = pickNumber(
            property?.demographics?.homeValue?.change,
            property?.demographics?.homeValueChange,
            property?.area?.census?.medianHomeValueChange,
            property?.area?.census?.medhomevaluechange
        );

        const attomViolentCrime = pickNumber(
            property?.area?.crime?.violent,
            property?.area?.crime?.violentCrime,
            property?.demographics?.crime?.violent,
            property?.demographics?.crime?.violentCrime
        );

        const attomPropertyCrime = pickNumber(
            property?.area?.crime?.property,
            property?.area?.crime?.propertyCrime,
            property?.demographics?.crime?.property,
            property?.demographics?.crime?.propertyCrime
        );

        const attomTwoBrRent = pickNumber(
            property?.demographics?.rent?.twoBr,
            property?.demographics?.rent?.twoBedroom,
            property?.demographics?.rent?.median2br,
            property?.area?.census?.rent2br
        );

        let demographicsSource = 'ATTOM';
        let population = attomPopulation;
        let populationChange = attomPopulationChange;
        let medianHouseholdIncome = attomMedianIncome;
        let medianHouseholdIncomeChange = attomMedianIncomeChange;
        let povertyRate = attomPovertyRate;
        let numberOfEmployees = attomEmployees;
        let numberOfEmployeesChange = attomEmployeesChange;
        let medianPropertyValue = attomMedianPropertyValue;
        let medianPropertyValueChange = attomMedianPropertyValueChange;
        let violentCrime = attomViolentCrime;
        let propertyCrime = attomPropertyCrime;
        let twoBrRent = attomTwoBrRent;
        const useCommunityViolentCrime = communityViolentCrime !== null;
        const useCommunityPropertyCrime = communityPropertyCrime !== null;
        if (useCommunityViolentCrime) violentCrime = communityViolentCrime;
        if (useCommunityPropertyCrime) propertyCrime = communityPropertyCrime;
        if ((useCommunityViolentCrime || useCommunityPropertyCrime) && demographicsSource === 'ATTOM') {
            demographicsSource = 'ATTOM Community';
        }

        const needsCensus =
            !population || population === 0 ||
            !medianHouseholdIncome || medianHouseholdIncome === 0 ||
            !numberOfEmployees || numberOfEmployees === 0 ||
            !medianPropertyValue || medianPropertyValue === 0 ||
            !twoBrRent || twoBrRent === 0 ||
            populationChange === null ||
            medianHouseholdIncomeChange === null ||
            numberOfEmployeesChange === null ||
            medianPropertyValueChange === null;

        if (needsCensus && fipsCode) {
            const censusCurrent = await fetchCensusMetrics(fipsCode, 2022);
            const censusPrevious = await fetchCensusMetrics(fipsCode, 2021);
            if (censusCurrent) {
                if (!population && censusCurrent.population) population = censusCurrent.population;
                if (!medianHouseholdIncome && censusCurrent.medianHouseholdIncome) {
                    medianHouseholdIncome = censusCurrent.medianHouseholdIncome;
                }
                if (!numberOfEmployees && censusCurrent.employed) {
                    numberOfEmployees = censusCurrent.employed;
                }
                if (!medianPropertyValue && censusCurrent.medianPropertyValue) {
                    medianPropertyValue = censusCurrent.medianPropertyValue;
                }
                if (!twoBrRent && censusCurrent.twoBrRent) {
                    twoBrRent = censusCurrent.twoBrRent;
                }
                if (!povertyRate && censusCurrent.population && censusCurrent.povertyCount !== null) {
                    povertyRate = Number(((censusCurrent.povertyCount / censusCurrent.population) * 100).toFixed(2));
                }
                demographicsSource = 'US Census API';
            }
            if (censusCurrent && censusPrevious) {
                if (populationChange === null) {
                    populationChange = calculatePercentChange(censusCurrent.population, censusPrevious.population);
                }
                if (medianHouseholdIncomeChange === null) {
                    medianHouseholdIncomeChange = calculatePercentChange(
                        censusCurrent.medianHouseholdIncome,
                        censusPrevious.medianHouseholdIncome
                    );
                }
                if (numberOfEmployeesChange === null) {
                    numberOfEmployeesChange = calculatePercentChange(censusCurrent.employed, censusPrevious.employed);
                }
                if (medianPropertyValueChange === null) {
                    medianPropertyValueChange = calculatePercentChange(
                        censusCurrent.medianPropertyValue,
                        censusPrevious.medianPropertyValue
                    );
                }
            }
        }

        if (
            (!population || population === 0) ||
            populationChange === null ||
            (!medianHouseholdIncome || medianHouseholdIncome === 0) ||
            (!povertyRate || povertyRate === 0) ||
            (!numberOfEmployees || numberOfEmployees === 0) ||
            (!medianPropertyValue || medianPropertyValue === 0) ||
            (!twoBrRent || twoBrRent === 0) ||
            (!violentCrime && communityViolentCrime !== null) ||
            (!propertyCrime && communityPropertyCrime !== null)
        ) {
            if (!population && communityPopulation) population = communityPopulation;
            if (populationChange === null && communityPopulationChange !== null) {
                populationChange = communityPopulationChange;
            }
            if (!medianHouseholdIncome && communityMedianIncome) {
                medianHouseholdIncome = communityMedianIncome;
            }
            if (!povertyRate && communityPovertyRate) {
                povertyRate = communityPovertyRate;
            }
            if (!numberOfEmployees && communityEmployees) {
                numberOfEmployees = communityEmployees;
            }
            if (!medianPropertyValue && communityMedianPropertyValue) {
                medianPropertyValue = communityMedianPropertyValue;
            }
            if (!twoBrRent && communityTwoBrRent) {
                twoBrRent = communityTwoBrRent;
            }
            if (!violentCrime && communityViolentCrime !== null) {
                violentCrime = communityViolentCrime;
            }
            if (!propertyCrime && communityPropertyCrime !== null) {
                propertyCrime = communityPropertyCrime;
            }
            if (community) {
                demographicsSource = 'ATTOM Community';
            }
        }

        const hudMetrics = await lookupHudChas(fipsCode);
        const unitsPer100 = hudMetrics?.unitsPer100 ?? null;
        const housingStatus = unitsPer100 === null
            ? 'Unavailable'
            : unitsPer100 < 30
                ? 'Critical Shortage'
                : 'Stable';
        let treasury10Year: { date: string | null; rate: number } | null = null;
        try {
            treasury10Year = await fetchTreasury10YearYield();
        } catch (error) {
            console.warn('Treasury 10Y fetch failed:', error);
        }

        return NextResponse.json({
            property_identity: {
                address: oneLine || address,
                apn:
                    property?.identifier?.apn ||
                    property?.identifier?.apnOrig ||
                    property?.identifier?.parcelId ||
                    null,
                fips_code: fipsCode,
                owner:
                    property?.owner?.name ||
                    property?.owner?.owner1FullName ||
                    property?.owner?.ownerName ||
                    null,
                county,
                city,
                state,
                zipCode: zip,
                property_type: propertyType,
                year_built: yearBuilt,
                acreage: acres,
                lot_size_sqft: lotSizeSqft,
            },
            financials: {
                source: 'ATTOM',
                market_value: marketValue,
                assessed_value: assessedValue,
                tax_amount: taxAmount,
                tax_prev_year_amount: previousTaxAmount ?? null,
                tax_year: taxYear,
                millage_rate: millageRate,
                assessment_ratio: assessmentRatio,
                last_sale_date: sale?.saleDate || sale?.date || null,
                last_sale_price: lastSalePrice,
                us_10_year_treasury: treasury10Year?.rate ?? null,
                us_10_year_treasury_date: treasury10Year?.date ?? null,
            },
            demographics_economics: {
                source: demographicsSource,
                population: population ?? null,
                population_change: populationChange ?? null,
                median_household_income: medianHouseholdIncome ?? null,
                median_household_income_change: medianHouseholdIncomeChange ?? null,
                poverty_rate: toPercent(povertyRate),
                number_of_employees: numberOfEmployees ?? null,
                number_of_employees_change: numberOfEmployeesChange ?? null,
                median_property_value: medianPropertyValue ?? null,
                median_property_value_change: medianPropertyValueChange ?? null,
                violent_crime: violentCrime ?? null,
                property_crime: propertyCrime ?? null,
                two_br_rent: twoBrRent ?? null,
            },
            housing_crisis_metrics: {
                source: 'HUD CHAS Dataset (Lookup via FIPS)',
                eli_renter_households: hudMetrics?.eliRenterHouseholds ?? null,
                affordable_units_per_100: unitsPer100,
                total_units: hudMetrics?.totalUnits ?? null,
                status: housingStatus,
            },
            demographics_details: community?.community || null,
            attomId: attomId,
            source,
        });
    } catch (error: any) {
        console.error('ATTOM fetch failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

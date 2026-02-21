const STATE_FIPS: Record<string, string> = {
    AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09', DE: '10', DC: '11',
    FL: '12', GA: '13', HI: '15', ID: '16', IL: '17', IN: '18', IA: '19', KS: '20', KY: '21',
    LA: '22', ME: '23', MD: '24', MA: '25', MI: '26', MN: '27', MS: '28', MO: '29', MT: '30',
    NE: '31', NV: '32', NH: '33', NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38', OH: '39',
    OK: '40', OR: '41', PA: '42', RI: '44', SC: '45', SD: '46', TN: '47', TX: '48', UT: '49',
    VT: '50', VA: '51', WA: '53', WV: '54', WI: '55', WY: '56',
};

export const normalizeCountyName = (value: string) =>
    value
        .toLowerCase()
        .replace(/\s+county$/i, '')
        .replace(/\s+parish$/i, '')
        .replace(/\s+borough$/i, '')
        .replace(/\s+census\s+area$/i, '')
        .replace(/\s+municipality$/i, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

const resolveStateFips = (state: string) => {
    const normalized = state.trim().toUpperCase();
    return STATE_FIPS[normalized] || null;
};

export const fetchCountyFips = async (state: string | null, county: string | null) => {
    if (!state || !county) return null;

    const stateCode = resolveStateFips(state);
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

export const fetchFipsByCoordinates = async (lat: number, lng: number) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const params = new URLSearchParams();
    params.set('x', String(lng));
    params.set('y', String(lat));
    params.set('benchmark', 'Public_AR_Current');
    params.set('vintage', 'Current_Current');
    params.set('format', 'json');

    const response = await fetch(
        `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?${params.toString()}`
    );
    if (!response.ok) return null;

    const payload = await response.json();
    const geoid = payload?.result?.geographies?.Counties?.[0]?.GEOID;
    if (!geoid) return null;

    const normalized = String(geoid).trim();
    return normalized || null;
};

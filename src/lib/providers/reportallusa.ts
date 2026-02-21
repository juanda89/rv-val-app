import type { AutofillContext, NormalizedAutofillResponse } from '@/lib/providers/types';
import { applyCommonApiSnapshot, buildEmptyResponse, normalizeApn, normalizeText } from '@/lib/providers/utils';

const REPORTALLUSA_ENDPOINT = 'https://reportallusa.com/api/parcels';

const APN_KEY_PATTERNS = [
    'apn',
    'parcel',
    'parcel_number',
    'parcelnumber',
    'parcelid',
    'assessor_id',
    'formattedapn',
];

const OWNER_BLOCKLIST = /(mail|address|city|state|zip|postal|phone|email|id|type|careof|care_of|company)/i;
const OWNER_KEY_PATTERNS = /(ownername|owner_name|owner\d+name|primaryowner|primary_owner|secondaryowner|secondary_owner|owner1|owner2)/i;
const NAME_KEY_PATTERN = /(name|full.?name|display.?name|first.?name|last.?name)/i;

const findFirstApn = (payload: any): string | null => {
    if (!payload) return null;
    const stack: any[] = [payload];

    while (stack.length > 0) {
        const current = stack.pop();
        if (!current) continue;

        if (Array.isArray(current)) {
            current.forEach((entry) => stack.push(entry));
            continue;
        }

        if (typeof current !== 'object') continue;

        for (const [key, value] of Object.entries(current)) {
            const normalizedKey = String(key).toLowerCase();
            if (APN_KEY_PATTERNS.some((pattern) => normalizedKey.includes(pattern))) {
                const candidate = normalizeApn(value);
                if (candidate) return candidate;
            }
            if (value && typeof value === 'object') {
                stack.push(value);
            }
        }
    }

    return null;
};

const findFirstOwnerName = (payload: any): string | null => {
    if (!payload) return null;
    const stack: Array<{ node: any; ownerContext: boolean }> = [{ node: payload, ownerContext: false }];

    while (stack.length > 0) {
        const { node, ownerContext } = stack.pop()!;
        if (!node) continue;

        if (Array.isArray(node)) {
            node.forEach((entry) => stack.push({ node: entry, ownerContext }));
            continue;
        }

        if (typeof node !== 'object') continue;

        for (const [rawKey, rawValue] of Object.entries(node)) {
            const key = String(rawKey).toLowerCase();
            const inOwnerContext = ownerContext || key.includes('owner');

            if (typeof rawValue === 'string') {
                const normalized = normalizeText(rawValue);
                if (!normalized) continue;
                const isOwnerKey = OWNER_KEY_PATTERNS.test(key);
                const isNameKey = NAME_KEY_PATTERN.test(key);
                if ((isOwnerKey || (inOwnerContext && isNameKey) || (inOwnerContext && !OWNER_BLOCKLIST.test(key))) && !OWNER_BLOCKLIST.test(key)) {
                    return normalized;
                }
                continue;
            }

            if (rawValue && typeof rawValue === 'object') {
                stack.push({ node: rawValue, ownerContext: inOwnerContext });
            }
        }
    }

    return null;
};

const fetchReportAllUsa = async (params: URLSearchParams) => {
    const response = await fetch(`${REPORTALLUSA_ENDPOINT}?${params.toString()}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
    });

    if (response.status === 404) return null;
    if (!response.ok) {
        throw new Error(`ReportAllUSA request failed with status ${response.status}`);
    }

    const payload = await response.json();
    return payload;
};

export const autofillWithReportAllUsa = async (context: AutofillContext): Promise<NormalizedAutofillResponse> => {
    const client = process.env.REPORTALLUSA_CLIENT;
    if (!client) {
        return buildEmptyResponse('reportallusa', 'ReportAllUSA client key is missing.');
    }

    let payload: any = null;
    let lookupSource: 'apn' | 'address' | 'lat_lng' | null = null;

    if (context.apn && context.fips_code) {
        const params = new URLSearchParams();
        params.set('client', client);
        params.set('v', '2');
        params.set('county_id', String(context.fips_code).replace(/\D/g, '').padStart(5, '0').slice(-5));
        params.set('apn', context.apn);
        payload = await fetchReportAllUsa(params);
        lookupSource = 'apn';
    }

    if (context.address && context.fips_code) {
        const params = new URLSearchParams();
        params.set('client', client);
        params.set('v', '2');
        params.set('county_id', String(context.fips_code).replace(/\D/g, '').padStart(5, '0').slice(-5));
        params.set('address', context.address);
        payload = await fetchReportAllUsa(params);
        lookupSource = 'address';
    }

    let apn = findFirstApn(payload);

    if (!apn && Number.isFinite(context.lat) && Number.isFinite(context.lng)) {
        const params = new URLSearchParams();
        params.set('client', client);
        params.set('v', '9');
        params.set('spatial_intersect', `POINT(${context.lng} ${context.lat})`);
        params.set('si_srid', '4326');
        payload = await fetchReportAllUsa(params);
        lookupSource = 'lat_lng';
        apn = findFirstApn(payload);
    }

    if (!apn) {
        return buildEmptyResponse('reportallusa', 'No APN/Assessor ID found via address or coordinates for reportallusa.');
    }

    const ownerName = findFirstOwnerName(payload);
    const snapshot = applyCommonApiSnapshot({
        ownerName,
        apn,
        fips: context.fips_code,
    });

    return {
        apn_found: true,
        apn_lookup_source: lookupSource,
        apn_value: apn,
        assessor_id: apn,
        property_identity: {
            address: normalizeText(context.address),
            apn,
            assessor_id: apn,
            fips_code: normalizeText(context.fips_code),
            owner: ownerName,
            county: normalizeText(context.county),
            city: normalizeText(context.city),
            state: normalizeText(context.state),
            zipCode: normalizeText(context.zip_code),
            property_type: null,
            year_built: null,
            acreage: null,
            lot_size_sqft: null,
        },
        financials: {
            source: 'ReportAllUSA',
            market_value: null,
            assessed_value: null,
            tax_amount: null,
            tax_prev_year_amount: null,
            tax_year: null,
            millage_rate: null,
            assessment_ratio: null,
            last_sale_date: null,
            last_sale_price: null,
            us_10_year_treasury: null,
            us_10_year_treasury_date: null,
        },
        demographics_economics: {
            source: null,
            population: null,
            population_change: null,
            median_household_income: null,
            median_household_income_change: null,
            poverty_rate: null,
            number_of_employees: null,
            number_of_employees_change: null,
            median_property_value: null,
            median_property_value_change: null,
            violent_crime: null,
            property_crime: null,
            two_br_rent: null,
        },
        housing_crisis_metrics: {
            source: null,
            eli_renter_households: null,
            affordable_units_per_100: null,
            total_units: null,
            status: null,
        },
        demographics_details: null,
        api_snapshot: snapshot,
        source_provider: 'reportallusa',
        message: `ReportAllUSA: APN found via ${
            lookupSource === 'lat_lng' ? 'coordinates' : lookupSource === 'apn' ? 'APN lookup' : 'address'
        } (APN-only mode).`,
    };
};

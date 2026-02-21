import type { AutofillContext, NormalizedAutofillResponse } from '@/lib/providers/types';
import {
    applyCommonApiSnapshot,
    buildEmptyResponse,
    calculateAssessmentRatio,
    calculateMillage,
    normalizeApn,
    normalizeFips,
    normalizeText,
    toInteger,
    toNumber,
} from '@/lib/providers/utils';

const MELISSA_LOOKUP_ENDPOINT = 'https://property.melissadata.net/v4/WEB/LookupProperty';
const MELISSA_REVERSE_ENDPOINT = 'https://reversegeo.melissadata.net/v3/web/ReverseGeoCode/doLookup';
const MELISSA_COLUMNS = 'GRP_PARCEL,GRP_TAX,GRP_PRIMARY_OWNER,GRP_PROPERTY_USE_INFO,GRP_SALE_INFO,GRP_PROPERTY_SIZE';

const splitAddress = (value?: string) => {
    const normalized = String(value || '')
        .replace(/,?\s*USA$/i, '')
        .replace(/\s+/g, ' ')
        .trim();

    const parts = normalized
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);

    if (parts.length >= 2) {
        const [line1, city = '', stateZip = ''] = [parts[0], parts[1], parts[2] || ''];
        const [state = '', zip = ''] = stateZip.split(/\s+/);
        return { line1, city, state, zip };
    }

    return { line1: normalized, city: '', state: '', zip: '' };
};

const findFirstValueByKey = (payload: any, keyName: string): string | null => {
    if (!payload) return null;
    const stack: any[] = [payload];
    const target = keyName.toLowerCase();

    while (stack.length > 0) {
        const current = stack.pop();
        if (!current) continue;
        if (Array.isArray(current)) {
            current.forEach((entry) => stack.push(entry));
            continue;
        }
        if (typeof current !== 'object') continue;

        for (const [key, value] of Object.entries(current)) {
            if (String(key).toLowerCase() === target) {
                const normalized = normalizeText(value);
                if (normalized) return normalized;
            }
            if (value && typeof value === 'object') {
                stack.push(value);
            }
        }
    }

    return null;
};

const fetchMelissaLookup = async (params: URLSearchParams) => {
    const withColumns = new URLSearchParams(params);
    withColumns.set('columns', MELISSA_COLUMNS);

    const tryFetch = async (searchParams: URLSearchParams) => {
        const response = await fetch(`${MELISSA_LOOKUP_ENDPOINT}?${searchParams.toString()}`, {
            headers: { Accept: 'application/json' },
            cache: 'no-store',
        });
        if (!response.ok) {
            return null;
        }
        const payload = await response.json();
        return payload;
    };

    const firstAttempt = await tryFetch(withColumns);
    const firstRecord = firstAttempt?.Records?.[0];
    if (firstRecord) {
        return firstAttempt;
    }

    return tryFetch(params);
};

const fetchReverseAddressKey = async (apiKey: string, lat: number, lng: number) => {
    const params = new URLSearchParams();
    params.set('id', apiKey);
    params.set('format', 'json');
    params.set('lat', String(lat));
    params.set('long', String(lng));
    params.set('dist', '0.1');

    const response = await fetch(`${MELISSA_REVERSE_ENDPOINT}?${params.toString()}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
    });

    if (!response.ok) return null;
    const payload = await response.json();
    return findFirstValueByKey(payload, 'MelissaAddressKey');
};

const normalizeMelissaPayload = (payload: any, context: AutofillContext, lookupSource: 'address' | 'lat_lng'): NormalizedAutofillResponse => {
    const record = payload?.Records?.[0] || null;
    const apn = normalizeApn(record?.Parcel?.FormattedAPN || record?.Parcel?.UnformattedAPN || null);
    const fipsCode = normalizeFips(record?.Parcel?.FIPSCode || context.fips_code || null);
    const ownerName = normalizeText(record?.PrimaryOwner?.Name1Full || null);
    const acreage = toNumber(record?.PropertySize?.AreaLotAcres);
    const yearBuilt = toInteger(record?.PropertyUseInfo?.YearBuilt);
    const lastSalePrice =
        toNumber(record?.SaleInfo?.DeedLastSalePrice) ??
        toNumber(record?.SaleInfo?.AssessorLastSaleAmount) ??
        toNumber(record?.SaleInfo?.AssessorPriorSaleAmount);

    const marketValue = toNumber(record?.Tax?.MarketValueTotal);
    const assessedValue = toNumber(record?.Tax?.AssessedValueTotal);
    const taxAmount = toNumber(record?.Tax?.TaxBilledAmount);
    const taxYear = toInteger(record?.Tax?.TaxFiscalYear);
    const millageRate = calculateMillage(taxAmount, assessedValue);
    const assessmentRatio = calculateAssessmentRatio(assessedValue, marketValue);

    const snapshot = applyCommonApiSnapshot({
        ownerName,
        apn,
        fips: fipsCode,
        acreage,
        propertyType: record?.PropertyUseInfo?.PropertyUseType || record?.PropertyUseInfo?.PropertyUseGroup || null,
        yearBuilt,
        lastSalePrice,
        assessedValue,
        taxYear,
        taxAmount,
        marketValue,
        assessmentRatio,
        millageRate,
    });

    return {
        apn_found: Boolean(apn),
        apn_lookup_source: lookupSource,
        apn_value: apn,
        assessor_id: normalizeText(record?.Parcel?.UnformattedAPN || apn),
        property_identity: {
            address: normalizeText(context.address),
            apn,
            assessor_id: normalizeText(record?.Parcel?.UnformattedAPN || apn),
            fips_code: fipsCode,
            owner: ownerName,
            county: normalizeText(context.county),
            city: normalizeText(context.city),
            state: normalizeText(context.state),
            zipCode: normalizeText(context.zip_code),
            property_type: normalizeText(record?.PropertyUseInfo?.PropertyUseType || record?.PropertyUseInfo?.PropertyUseGroup),
            year_built: yearBuilt,
            acreage,
            lot_size_sqft: toNumber(record?.PropertySize?.AreaLotSF),
        },
        financials: {
            source: 'Melissa',
            market_value: marketValue,
            assessed_value: assessedValue,
            tax_amount: taxAmount,
            tax_prev_year_amount: taxAmount,
            tax_year: taxYear,
            millage_rate: millageRate,
            assessment_ratio: assessmentRatio,
            last_sale_date: normalizeText(record?.SaleInfo?.DeedLastSaleDate || record?.SaleInfo?.AssessorLastSaleDate),
            last_sale_price: lastSalePrice,
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
        source_provider: 'melissa',
        message: apn
            ? `Melissa: APN found via ${lookupSource === 'address' ? 'address' : 'coordinates'}.`
            : 'Melissa: no APN found.',
    };
};

export const autofillWithMelissa = async (context: AutofillContext): Promise<NormalizedAutofillResponse> => {
    const apiKey = process.env.MELISSA_API;
    if (!apiKey) {
        return buildEmptyResponse('melissa', 'Melissa API key is missing.');
    }

    const addressParts = splitAddress(context.address);
    const city = normalizeText(context.city) || addressParts.city;
    const state = normalizeText(context.state) || addressParts.state;
    const zip = normalizeText(context.zip_code) || addressParts.zip;

    if (context.apn) {
        const params = new URLSearchParams();
        params.set('id', apiKey);
        params.set('format', 'json');
        params.set('apn', context.apn);
        if (context.fips_code) {
            params.set('fips', String(context.fips_code).replace(/\D/g, '').padStart(5, '0').slice(-5));
        }
        const payload = await fetchMelissaLookup(params);
        if (payload?.Records?.[0]) {
            const normalized = normalizeMelissaPayload(payload, context, 'address');
            if (normalized.apn_found) {
                return {
                    ...normalized,
                    apn_lookup_source: 'apn',
                    message: 'Melissa: APN found via APN lookup.',
                };
            }
        }
    }

    if (context.address) {
        const params = new URLSearchParams();
        params.set('id', apiKey);
        params.set('format', 'json');
        params.set('a1', normalizeText(context.address) || addressParts.line1);
        if (city) params.set('city', city);
        if (state) params.set('state', state);
        if (zip) params.set('postal', zip);

        const payload = await fetchMelissaLookup(params);
        if (payload?.Records?.[0]) {
            const normalized = normalizeMelissaPayload(payload, context, 'address');
            if (normalized.apn_found) return normalized;
        }
    }

    if (Number.isFinite(context.lat) && Number.isFinite(context.lng)) {
        const addressKey = await fetchReverseAddressKey(apiKey, Number(context.lat), Number(context.lng));
        if (addressKey) {
            const params = new URLSearchParams();
            params.set('id', apiKey);
            params.set('format', 'json');
            params.set('mak', addressKey);

            const payload = await fetchMelissaLookup(params);
            if (payload?.Records?.[0]) {
                const normalized = normalizeMelissaPayload(payload, context, 'lat_lng');
                if (normalized.apn_found) return normalized;
                return {
                    ...normalized,
                    message: 'Melissa: property found with coordinates, but APN was not returned.',
                };
            }
        }
    }

    return buildEmptyResponse('melissa', 'No APN/Assessor ID found via address or coordinates for melissa.');
};

import type { AutofillContext, NormalizedAutofillResponse } from '@/lib/providers/types';
import {
    applyCommonApiSnapshot,
    buildEmptyResponse,
    calculateMillage,
    combineStateCountyFips,
    normalizeApn,
    normalizeText,
    parseYearMapLatest,
    toInteger,
    toNumber,
} from '@/lib/providers/utils';

const RENTCAST_ENDPOINT = 'https://api.rentcast.io/v1/properties';

const fetchRentcast = async (apiKey: string, params: URLSearchParams) => {
    const response = await fetch(`${RENTCAST_ENDPOINT}?${params.toString()}`, {
        headers: {
            Accept: 'application/json',
            'X-Api-Key': apiKey,
        },
        cache: 'no-store',
    });

    if (response.status === 404) return null;
    if (!response.ok) {
        throw new Error(`Rentcast request failed with status ${response.status}`);
    }

    const payload = await response.json();
    const property = Array.isArray(payload) ? payload[0] : null;
    return property || null;
};

const normalizeRentcastProperty = (
    property: Record<string, any>,
    context: AutofillContext,
    lookupSource: 'address' | 'lat_lng'
): NormalizedAutofillResponse => {
    const apn = normalizeApn(property?.assessorID);
    const fipsCode = combineStateCountyFips(property?.stateFips, property?.countyFips) || normalizeText(context.fips_code);

    const latestAssessment = parseYearMapLatest(property?.taxAssessments);
    const latestTaxes = parseYearMapLatest(property?.propertyTaxes);

    const assessedValue = toNumber(latestAssessment?.value?.value);
    const taxAmount = toNumber(latestTaxes?.value?.total);
    const taxYear = toInteger(latestTaxes?.value?.year ?? latestAssessment?.value?.year);
    const marketValue = toNumber(latestAssessment?.value?.value);

    const millageRate = calculateMillage(taxAmount, assessedValue);
    const acreage = toNumber(property?.lotSize) ? Number((Number(property.lotSize) / 43560).toFixed(4)) : null;
    const ownerName = Array.isArray(property?.owner?.names)
        ? property.owner.names.filter(Boolean).join(' & ')
        : normalizeText(property?.owner?.name);

    const snapshot = applyCommonApiSnapshot({
        ownerName,
        apn,
        fips: fipsCode,
        acreage,
        propertyType: property?.propertyType,
        yearBuilt: property?.yearBuilt,
        lastSalePrice: property?.lastSalePrice,
        assessedValue,
        taxYear,
        taxAmount,
        marketValue,
        millageRate,
    });

    return {
        apn_found: Boolean(apn),
        apn_lookup_source: lookupSource,
        apn_value: apn,
        assessor_id: apn,
        property_identity: {
            address: normalizeText(property?.formattedAddress || context.address),
            apn,
            assessor_id: apn,
            fips_code: fipsCode,
            owner: ownerName,
            county: normalizeText(property?.county || context.county),
            city: normalizeText(property?.city || context.city),
            state: normalizeText(property?.state || context.state),
            zipCode: normalizeText(property?.zipCode || context.zip_code),
            property_type: normalizeText(property?.propertyType),
            year_built: toInteger(property?.yearBuilt),
            acreage,
            lot_size_sqft: toNumber(property?.lotSize),
        },
        financials: {
            source: 'Rentcast',
            market_value: marketValue,
            assessed_value: assessedValue,
            tax_amount: taxAmount,
            tax_prev_year_amount: taxAmount,
            tax_year: taxYear,
            millage_rate: millageRate,
            assessment_ratio: null,
            last_sale_date: normalizeText(property?.lastSaleDate),
            last_sale_price: toNumber(property?.lastSalePrice),
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
        source_provider: 'rentcast',
        message: apn
            ? `Rentcast: APN found via ${lookupSource === 'address' ? 'address' : 'coordinates'}.`
            : 'Rentcast: no APN found.',
    };
};

export const autofillWithRentcast = async (context: AutofillContext): Promise<NormalizedAutofillResponse> => {
    const apiKey = process.env.RENTCAST_API_KEY;
    if (!apiKey) {
        return buildEmptyResponse('rentcast', 'Rentcast API key is missing.');
    }

    if (context.apn) {
        const params = new URLSearchParams();
        params.set('assessorID', context.apn);
        const property = await fetchRentcast(apiKey, params);
        if (property) {
            const normalized = normalizeRentcastProperty(property, context, 'address');
            if (normalized.apn_found) {
                return {
                    ...normalized,
                    apn_lookup_source: 'apn',
                    message: 'Rentcast: APN found via APN lookup.',
                };
            }
        }
    }

    if (context.address) {
        const params = new URLSearchParams();
        params.set('address', context.address);
        const property = await fetchRentcast(apiKey, params);
        if (property) {
            const normalized = normalizeRentcastProperty(property, context, 'address');
            if (normalized.apn_found) return normalized;
        }
    }

    if (Number.isFinite(context.lat) && Number.isFinite(context.lng)) {
        const params = new URLSearchParams();
        params.set('latitude', String(context.lat));
        params.set('longitude', String(context.lng));
        params.set('radius', '0.1');
        const property = await fetchRentcast(apiKey, params);
        if (property) {
            const normalized = normalizeRentcastProperty(property, context, 'lat_lng');
            if (normalized.apn_found) return normalized;
            return {
                ...normalized,
                message: 'Rentcast: property found with coordinates, but APN was not returned.',
            };
        }
    }

    return buildEmptyResponse('rentcast', 'No APN/Assessor ID found via address or coordinates for rentcast.');
};

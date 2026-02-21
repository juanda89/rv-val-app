import type { AutofillContext, NormalizedAutofillResponse } from '@/lib/providers/types';
import {
    applyCommonApiSnapshot,
    buildEmptyResponse,
    calculateMillage,
    combineStateCountyFips,
    normalizeApn,
    normalizeFips,
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

    if (response.status === 404) return [];
    if (!response.ok) {
        throw new Error(`Rentcast request failed with status ${response.status}`);
    }

    const payload = await response.json();
    return Array.isArray(payload) ? payload.filter(Boolean) : [];
};

type LookupSource = 'apn' | 'address' | 'lat_lng';

type PropertyCandidate = {
    property: Record<string, any>;
    source: LookupSource;
};

const getPropertyFips = (property: Record<string, any>) =>
    normalizeFips(combineStateCountyFips(property?.stateFips, property?.countyFips));

const matchesConstraints = (
    property: Record<string, any>,
    targetApn: string | null,
    targetFips: string | null
) => {
    const propertyApn = normalizeApn(property?.assessorID);
    const propertyFips = getPropertyFips(property);
    const matchesApn = targetApn ? propertyApn === targetApn : true;
    const matchesFips = targetFips ? propertyFips === targetFips : true;
    return matchesApn && matchesFips;
};

const pickRentcastMatch = (
    candidates: PropertyCandidate[],
    targetApn: string | null,
    targetFips: string | null,
    strict = false
) => {
    if (candidates.length === 0) return null;
    const strictMatch = candidates.find(({ property }) => matchesConstraints(property, targetApn, targetFips));
    if (strictMatch || strict) return strictMatch ?? null;

    if (targetApn && targetFips) {
        const apnMatch = candidates.find(({ property }) => normalizeApn(property?.assessorID) === targetApn);
        if (apnMatch) return apnMatch;
        const fipsMatch = candidates.find(({ property }) => getPropertyFips(property) === targetFips);
        if (fipsMatch) return fipsMatch;
    } else if (targetApn) {
        const apnMatch = candidates.find(({ property }) => normalizeApn(property?.assessorID) === targetApn);
        if (apnMatch) return apnMatch;
    } else if (targetFips) {
        const fipsMatch = candidates.find(({ property }) => getPropertyFips(property) === targetFips);
        if (fipsMatch) return fipsMatch;
    }

    return candidates[0];
};

const normalizeRentcastProperty = (
    property: Record<string, any>,
    context: AutofillContext,
    lookupSource: LookupSource,
    hasConstraintMismatch = false
): NormalizedAutofillResponse => {
    const apn = normalizeApn(property?.assessorID);
    const fipsCode = normalizeFips(combineStateCountyFips(property?.stateFips, property?.countyFips)) || normalizeFips(context.fips_code);

    const latestAssessment = parseYearMapLatest(property?.taxAssessments);
    const latestTaxes = parseYearMapLatest(property?.propertyTaxes);

    const assessedValue = toNumber(latestAssessment?.value?.value);
    const taxAmount = toNumber(latestTaxes?.value?.total);
    const taxYear = toInteger(latestTaxes?.value?.year ?? latestAssessment?.value?.year);
    const marketValue = toNumber(latestAssessment?.value?.value);
    const hasTaxFinancialFields = [assessedValue, taxAmount, taxYear, marketValue].some((value) => value !== null);

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
        message: context.intent === 'taxes'
            ? hasTaxFinancialFields
                ? 'Rentcast: tax financial fields loaded for APN/FIPS match.'
                : 'Rentcast: property matched by APN/FIPS, but tax financial fields were not returned.'
            : apn
                ? hasConstraintMismatch
                    ? `Rentcast: property found via ${
                        lookupSource === 'apn'
                            ? 'APN lookup'
                            : lookupSource === 'address'
                                ? 'address'
                                : 'coordinates'
                    }, but APN/FIPS did not fully match provided constraints.`
                    : `Rentcast: APN found via ${
                        lookupSource === 'apn'
                            ? 'APN lookup'
                            : lookupSource === 'address'
                                ? 'address'
                                : 'coordinates'
                    }.`
                : 'Rentcast: no APN found.',
    };
};

export const autofillWithRentcast = async (context: AutofillContext): Promise<NormalizedAutofillResponse> => {
    const apiKey = process.env.RENTCAST_API_KEY;
    if (!apiKey) {
        return buildEmptyResponse('rentcast', 'Rentcast API key is missing.');
    }

    const targetApn = normalizeApn(context.apn);
    const targetFips = normalizeFips(context.fips_code);

    if (context.intent === 'taxes') {
        if (!context.address) {
            return buildEmptyResponse('rentcast', 'Rentcast taxes lookup requires a property address.');
        }

        const params = new URLSearchParams();
        params.set('address', context.address);

        let addressLookupProperties: Record<string, any>[] = [];
        try {
            addressLookupProperties = await fetchRentcast(apiKey, params);
        } catch (error) {
            console.warn('Rentcast taxes address lookup failed:', error);
            return buildEmptyResponse('rentcast', 'Rentcast: unable to query taxes data by address.');
        }

        const addressCandidates: PropertyCandidate[] = addressLookupProperties.map((property) => ({ property, source: 'address' }));
        const strictTaxMatch = pickRentcastMatch(addressCandidates, targetApn, targetFips, true);
        if (!strictTaxMatch) {
            return buildEmptyResponse('rentcast', 'Rentcast: tax financial fields unavailable for APN/FIPS match.');
        }

        const normalized = normalizeRentcastProperty(
            strictTaxMatch.property,
            context,
            strictTaxMatch.source,
            false
        );
        if (normalized.apn_found) return normalized;
        return buildEmptyResponse('rentcast', 'Rentcast: tax financial fields unavailable for APN/FIPS match.');
    }

    let apnLookupProperties: Record<string, any>[] = [];
    let addressLookupProperties: Record<string, any>[] = [];
    let geoLookupProperties: Record<string, any>[] = [];

    if (targetApn) {
        const params = new URLSearchParams();
        params.set('assessorID', targetApn);
        try {
            apnLookupProperties = await fetchRentcast(apiKey, params);
        } catch (error) {
            console.warn('Rentcast assessorID lookup failed, continuing with other strategies:', error);
        }
    }

    if (context.address) {
        const params = new URLSearchParams();
        params.set('address', context.address);
        try {
            addressLookupProperties = await fetchRentcast(apiKey, params);
        } catch (error) {
            console.warn('Rentcast address lookup failed:', error);
        }
    }

    if (Number.isFinite(context.lat) && Number.isFinite(context.lng)) {
        const params = new URLSearchParams();
        params.set('latitude', String(context.lat));
        params.set('longitude', String(context.lng));
        params.set('radius', '0.1');
        try {
            geoLookupProperties = await fetchRentcast(apiKey, params);
        } catch (error) {
            console.warn('Rentcast coordinates lookup failed:', error);
        }
    }

    const apnCandidates: PropertyCandidate[] = apnLookupProperties.map((property) => ({ property, source: 'apn' }));
    const addressCandidates: PropertyCandidate[] = addressLookupProperties.map((property) => ({ property, source: 'address' }));
    const geoCandidates: PropertyCandidate[] = geoLookupProperties.map((property) => ({ property, source: 'lat_lng' }));
    const allCandidates: PropertyCandidate[] = [...apnCandidates, ...addressCandidates, ...geoCandidates];

    const apnMatch = pickRentcastMatch(apnCandidates, targetApn, targetFips, false);
    if (apnMatch) {
        const normalized = normalizeRentcastProperty(
            apnMatch.property,
            context,
            apnMatch.source,
            !matchesConstraints(apnMatch.property, targetApn, targetFips)
        );
        if (normalized.apn_found) return normalized;
    }

    const addressMatch = pickRentcastMatch(addressCandidates, targetApn, targetFips, false);
    if (addressMatch) {
        const normalized = normalizeRentcastProperty(
            addressMatch.property,
            context,
            addressMatch.source,
            !matchesConstraints(addressMatch.property, targetApn, targetFips)
        );
        if (normalized.apn_found) return normalized;
    }

    const geoMatch = pickRentcastMatch(geoCandidates, targetApn, targetFips, false);
    if (geoMatch) {
        const normalized = normalizeRentcastProperty(
            geoMatch.property,
            context,
            geoMatch.source,
            !matchesConstraints(geoMatch.property, targetApn, targetFips)
        );
        if (normalized.apn_found) return normalized;
        return {
            ...normalized,
            message: 'Rentcast: property found with coordinates, but APN was not returned.',
        };
    }

    return buildEmptyResponse('rentcast', 'No APN/Assessor ID found via address or coordinates for rentcast.');
};

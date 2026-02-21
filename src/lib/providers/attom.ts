import type { AutofillContext, NormalizedAutofillResponse } from '@/lib/providers/types';
import { applyCommonApiSnapshot, buildEmptyResponse, normalizeText } from '@/lib/providers/utils';

const toApiSnapshot = (payload: any) => {
    const identity = payload?.property_identity || {};
    const financials = payload?.financials || {};
    const demographics = payload?.demographics_economics || {};
    const housing = payload?.housing_crisis_metrics || {};

    const snapshot = applyCommonApiSnapshot({
        ownerName: identity?.owner,
        apn: identity?.apn,
        fips: identity?.fips_code,
        acreage: identity?.acreage,
        propertyType: identity?.property_type,
        yearBuilt: identity?.year_built,
        lastSalePrice: financials?.last_sale_price,
        assessedValue: financials?.assessed_value,
        taxYear: financials?.tax_year,
        taxAmount: financials?.tax_prev_year_amount ?? financials?.tax_amount,
        marketValue: financials?.market_value,
        assessmentRatio: financials?.assessment_ratio,
        millageRate: financials?.millage_rate,
    });

    const extraPairs: Array<[string, unknown]> = [
        ['population', demographics?.population],
        ['population_change', demographics?.population_change],
        ['median_household_income', demographics?.median_household_income],
        ['median_household_income_change', demographics?.median_household_income_change],
        ['poverty_rate', demographics?.poverty_rate],
        ['number_of_employees', demographics?.number_of_employees],
        ['number_of_employees_change', demographics?.number_of_employees_change],
        ['median_property_value', demographics?.median_property_value],
        ['median_property_value_change', demographics?.median_property_value_change],
        ['violent_crime', demographics?.violent_crime],
        ['property_crime', demographics?.property_crime],
        ['two_br_rent', demographics?.two_br_rent],
        ['eli_renter_households', housing?.eli_renter_households],
        ['units_per_100', housing?.affordable_units_per_100],
        ['total_units', housing?.total_units],
        ['us_10_year_treasury', financials?.us_10_year_treasury],
    ];

    extraPairs.forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
            snapshot[key] = value;
        }
    });

    return snapshot;
};

const callAttomRoute = async (origin: string, body: Record<string, any>) => {
    const response = await fetch(`${origin}/api/attom/property`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
    });

    const payload = await response.json().catch(() => ({}));
    return { response, payload };
};

const toNormalized = (payload: any, lookupSource: 'apn' | 'address' | 'lat_lng'): NormalizedAutofillResponse => {
    const identity = payload?.property_identity || {};
    const apn = normalizeText(identity?.apn);
    const snapshot = toApiSnapshot(payload);

    return {
        apn_found: Boolean(apn),
        apn_lookup_source: lookupSource,
        apn_value: apn,
        assessor_id: apn,
        property_identity: {
            address: normalizeText(identity?.address),
            apn,
            assessor_id: apn,
            fips_code: normalizeText(identity?.fips_code),
            owner: normalizeText(identity?.owner),
            county: normalizeText(identity?.county),
            city: normalizeText(identity?.city),
            state: normalizeText(identity?.state),
            zipCode: normalizeText(identity?.zipCode),
            property_type: normalizeText(identity?.property_type),
            year_built: identity?.year_built ?? null,
            acreage: identity?.acreage ?? null,
            lot_size_sqft: identity?.lot_size_sqft ?? null,
        },
        financials: {
            source: payload?.financials?.source || 'ATTOM',
            market_value: payload?.financials?.market_value ?? null,
            assessed_value: payload?.financials?.assessed_value ?? null,
            tax_amount: payload?.financials?.tax_amount ?? null,
            tax_prev_year_amount: payload?.financials?.tax_prev_year_amount ?? null,
            tax_year: payload?.financials?.tax_year ?? null,
            millage_rate: payload?.financials?.millage_rate ?? null,
            assessment_ratio: payload?.financials?.assessment_ratio ?? null,
            last_sale_date: payload?.financials?.last_sale_date ?? null,
            last_sale_price: payload?.financials?.last_sale_price ?? null,
            us_10_year_treasury: payload?.financials?.us_10_year_treasury ?? null,
            us_10_year_treasury_date: payload?.financials?.us_10_year_treasury_date ?? null,
        },
        demographics_economics: {
            source: payload?.demographics_economics?.source ?? null,
            population: payload?.demographics_economics?.population ?? null,
            population_change: payload?.demographics_economics?.population_change ?? null,
            median_household_income: payload?.demographics_economics?.median_household_income ?? null,
            median_household_income_change: payload?.demographics_economics?.median_household_income_change ?? null,
            poverty_rate: payload?.demographics_economics?.poverty_rate ?? null,
            number_of_employees: payload?.demographics_economics?.number_of_employees ?? null,
            number_of_employees_change: payload?.demographics_economics?.number_of_employees_change ?? null,
            median_property_value: payload?.demographics_economics?.median_property_value ?? null,
            median_property_value_change: payload?.demographics_economics?.median_property_value_change ?? null,
            violent_crime: payload?.demographics_economics?.violent_crime ?? null,
            property_crime: payload?.demographics_economics?.property_crime ?? null,
            two_br_rent: payload?.demographics_economics?.two_br_rent ?? null,
        },
        housing_crisis_metrics: {
            source: payload?.housing_crisis_metrics?.source ?? null,
            eli_renter_households: payload?.housing_crisis_metrics?.eli_renter_households ?? null,
            affordable_units_per_100: payload?.housing_crisis_metrics?.affordable_units_per_100 ?? null,
            total_units: payload?.housing_crisis_metrics?.total_units ?? null,
            status: payload?.housing_crisis_metrics?.status ?? null,
        },
        demographics_details: payload?.demographics_details || null,
        api_snapshot: snapshot,
        source_provider: 'attom',
        message: apn
            ? `ATTOM: APN found via ${lookupSource === 'address' ? 'address' : 'coordinates'}.`
            : 'ATTOM: property found but APN missing.',
    };
};

export const autofillWithAttom = async (
    context: AutofillContext,
    requestOrigin: string
): Promise<NormalizedAutofillResponse> => {
    if (context.apn && context.fips_code) {
        const { response, payload } = await callAttomRoute(requestOrigin, {
            apn: context.apn,
            fips: context.fips_code,
            address: context.address,
        });

        if (response.ok && payload?.property_identity) {
            const normalized = toNormalized(payload, 'apn');
            if (normalized.apn_found) return normalized;
        }
    }

    if (context.address) {
        const { response, payload } = await callAttomRoute(requestOrigin, {
            address: context.address,
            apn: context.apn,
            fips: context.fips_code,
        });

        if (response.ok && payload?.property_identity) {
            const normalized = toNormalized(payload, 'address');
            if (normalized.apn_found) return normalized;
        }
    }

    if (Number.isFinite(context.lat) && Number.isFinite(context.lng)) {
        const { response, payload } = await callAttomRoute(requestOrigin, {
            lat: context.lat,
            lng: context.lng,
            apn: context.apn,
            fips: context.fips_code,
            address: context.address,
        });

        if (response.ok && payload?.property_identity) {
            const normalized = toNormalized(payload, 'lat_lng');
            if (normalized.apn_found) return normalized;
            return {
                ...normalized,
                message: 'ATTOM: property found with coordinates, but APN was not returned.',
            };
        }
    }

    return buildEmptyResponse('attom', 'No APN/Assessor ID found via address or coordinates for attom.');
};

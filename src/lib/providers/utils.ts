import type { ApiProvider } from '@/types/apiProvider';
import type {
    DemographicsEconomics,
    Financials,
    HousingCrisisMetrics,
    NormalizedAutofillResponse,
    PropertyIdentity,
} from '@/lib/providers/types';

export const toNumber = (value: unknown) => {
    if (value === null || value === undefined || value === '') return null;
    const cleaned = String(value).replace(/[$,%\s,]/g, '');
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
};

export const toInteger = (value: unknown) => {
    const parsed = toNumber(value);
    return parsed === null ? null : Math.trunc(parsed);
};

export const normalizeText = (value: unknown) => {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    return text ? text : null;
};

export const normalizeApn = (value: unknown) => {
    const raw = normalizeText(value);
    if (!raw) return null;
    return raw.replace(/[\s-]+/g, '');
};

export const normalizeFips = (value: unknown) => {
    const raw = normalizeText(value);
    if (!raw) return null;
    const digits = raw.replace(/\D/g, '');
    if (!digits) return null;
    return digits.padStart(5, '0').slice(-5);
};

export const calculateMillage = (taxAmount: number | null, assessedValue: number | null) => {
    if (taxAmount === null || assessedValue === null || assessedValue === 0) return null;
    return Number(((taxAmount / assessedValue) * 1000).toFixed(3));
};

export const calculateAssessmentRatio = (assessedValue: number | null, baseValue: number | null) => {
    if (assessedValue === null || baseValue === null || baseValue === 0) return null;
    return Number((assessedValue / baseValue).toFixed(3));
};

const defaultPropertyIdentity = (): PropertyIdentity => ({
    address: null,
    apn: null,
    assessor_id: null,
    fips_code: null,
    owner: null,
    county: null,
    city: null,
    state: null,
    zipCode: null,
    property_type: null,
    year_built: null,
    acreage: null,
    lot_size_sqft: null,
});

const defaultFinancials = (): Financials => ({
    source: null,
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
});

const defaultDemographics = (): DemographicsEconomics => ({
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
});

const defaultHousing = (): HousingCrisisMetrics => ({
    source: null,
    eli_renter_households: null,
    affordable_units_per_100: null,
    total_units: null,
    status: null,
});

export const buildEmptyResponse = (
    provider: ApiProvider,
    message: string,
    overrides?: Partial<NormalizedAutofillResponse>
): NormalizedAutofillResponse => ({
    apn_found: false,
    apn_lookup_source: null,
    apn_value: null,
    assessor_id: null,
    property_identity: defaultPropertyIdentity(),
    financials: defaultFinancials(),
    demographics_economics: defaultDemographics(),
    housing_crisis_metrics: defaultHousing(),
    demographics_details: null,
    api_snapshot: {},
    source_provider: provider,
    message,
    ...overrides,
});

export const applyCommonApiSnapshot = (payload: {
    ownerName?: unknown;
    apn?: unknown;
    fips?: unknown;
    acreage?: unknown;
    propertyType?: unknown;
    yearBuilt?: unknown;
    lastSalePrice?: unknown;
    assessedValue?: unknown;
    taxYear?: unknown;
    taxAmount?: unknown;
    marketValue?: unknown;
    assessmentRatio?: unknown;
    millageRate?: unknown;
    extra?: Record<string, any>;
}) => {
    const snapshot: Record<string, any> = { ...(payload.extra || {}) };
    const ownerName = normalizeText(payload.ownerName);
    const apn = normalizeApn(payload.apn);
    const fipsCode = normalizeFips(payload.fips);
    const acreage = toNumber(payload.acreage);
    const propertyType = normalizeText(payload.propertyType);
    const yearBuilt = toInteger(payload.yearBuilt);
    const lastSalePrice = toNumber(payload.lastSalePrice);
    const assessedValue = toNumber(payload.assessedValue);
    const taxYear = toInteger(payload.taxYear);
    const taxAmount = toNumber(payload.taxAmount);
    const marketValue = toNumber(payload.marketValue);
    const assessmentRatio = toNumber(payload.assessmentRatio);
    const millageRate = toNumber(payload.millageRate);

    if (ownerName !== null) snapshot.owner_name = ownerName;
    if (apn !== null) {
        snapshot.parcel_1 = apn;
        snapshot.parcelNumber = apn;
    }
    if (fipsCode !== null) snapshot.fips_code = fipsCode;
    if (acreage !== null) {
        snapshot.acreage = acreage;
        snapshot.parcel_1_acreage = acreage;
    }
    if (propertyType !== null) snapshot.property_type = propertyType;
    if (yearBuilt !== null) snapshot.year_built = yearBuilt;
    if (lastSalePrice !== null) snapshot.last_sale_price = lastSalePrice;
    if (assessedValue !== null) {
        snapshot.tax_assessed_value = assessedValue;
        snapshot.assessed_value = assessedValue;
    }
    if (taxYear !== null) snapshot.tax_year = taxYear;
    if (taxAmount !== null) {
        snapshot.tax_prev_year_amount = taxAmount;
        snapshot.previous_year_re_taxes = taxAmount;
    }
    if (marketValue !== null) snapshot.fair_market_value = marketValue;
    if (assessmentRatio !== null) snapshot.tax_assessment_rate = assessmentRatio;
    if (millageRate !== null) snapshot.tax_millage_rate = millageRate;

    return snapshot;
};

export const combineStateCountyFips = (stateFips: unknown, countyFips: unknown) => {
    const st = normalizeText(stateFips)?.replace(/\D/g, '');
    const county = normalizeText(countyFips)?.replace(/\D/g, '');
    if (!st || !county) return null;
    return `${st.padStart(2, '0')}${county.padStart(3, '0')}`;
};

export const parseYearMapLatest = (mapObj: Record<string, any> | null | undefined) => {
    if (!mapObj || typeof mapObj !== 'object') return null;
    const entries = Object.entries(mapObj)
        .map(([key, value]) => {
            const yearCandidate = toInteger((value as any)?.year) ?? toInteger(key);
            return {
                year: yearCandidate ?? -1,
                value: value as Record<string, any>,
            };
        })
        .filter((entry) => entry.year >= 0)
        .sort((a, b) => b.year - a.year);
    return entries[0] || null;
};

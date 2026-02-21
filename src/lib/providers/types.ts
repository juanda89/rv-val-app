import type { ApiProvider } from '@/types/apiProvider';

export type ApnLookupSource = 'apn' | 'address' | 'lat_lng' | null;

export type AutofillContext = {
    intent?: 'step1' | 'taxes';
    address?: string;
    apn?: string;
    lat?: number;
    lng?: number;
    fips_code?: string;
    county?: string;
    city?: string;
    state?: string;
    zip_code?: string;
};

export type PropertyIdentity = {
    address: string | null;
    apn: string | null;
    assessor_id: string | null;
    fips_code: string | null;
    owner: string | null;
    county: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    property_type: string | null;
    year_built: number | null;
    acreage: number | null;
    lot_size_sqft: number | null;
};

export type Financials = {
    source: string | null;
    market_value: number | null;
    assessed_value: number | null;
    tax_amount: number | null;
    tax_prev_year_amount: number | null;
    tax_year: number | null;
    millage_rate: number | null;
    assessment_ratio: number | null;
    last_sale_date: string | null;
    last_sale_price: number | null;
    us_10_year_treasury: number | null;
    us_10_year_treasury_date: string | null;
};

export type DemographicsEconomics = {
    source: string | null;
    population: number | null;
    population_change: number | null;
    median_household_income: number | null;
    median_household_income_change: number | null;
    poverty_rate: number | null;
    number_of_employees: number | null;
    number_of_employees_change: number | null;
    median_property_value: number | null;
    median_property_value_change: number | null;
    violent_crime: number | null;
    property_crime: number | null;
    two_br_rent: number | null;
};

export type HousingCrisisMetrics = {
    source: string | null;
    eli_renter_households: number | null;
    affordable_units_per_100: number | null;
    total_units: number | null;
    status: string | null;
};

export type NormalizedAutofillResponse = {
    apn_found: boolean;
    apn_lookup_source: ApnLookupSource;
    apn_value: string | null;
    assessor_id: string | null;
    property_identity: PropertyIdentity;
    financials: Financials;
    demographics_economics: DemographicsEconomics;
    housing_crisis_metrics: HousingCrisisMetrics;
    demographics_details: Record<string, any> | null;
    api_snapshot: Record<string, any>;
    source_provider: ApiProvider;
    message: string;
};

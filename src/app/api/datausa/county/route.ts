import { NextResponse } from 'next/server';
import { lookupHudChas } from '@/lib/hudChas';

export const runtime = 'nodejs';

type DataUsaTesseractRow = {
    Year?: unknown;
    Population?: unknown;
    'Household Income by Race'?: unknown;
    'Property Value'?: unknown;
    'Poverty Population'?: unknown;
    'Violent Crime'?: unknown;
    County?: unknown;
};

const toNumber = (value: unknown) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(String(value).replace(/[$,%\s,]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
};

const calculatePercentChange = (latest: number | null, previous: number | null) => {
    if (latest === null || previous === null || previous === 0) return null;
    return Number((((latest - previous) / previous) * 100).toFixed(2));
};

const PROPERTY_CRIME_FACTOR = 1.63;

const fetchSeriesPair = async (
    cube: string,
    measure: 'Population' | 'Household Income by Race' | 'Property Value' | 'Poverty Population',
    countyCode: string
) => {
    const params = new URLSearchParams();
    params.set('cube', cube);
    params.set('drilldowns', 'County,Year');
    params.set('measures', measure);
    params.set('include', `County:${countyCode}`);

    const response = await fetch(`https://api.datausa.io/tesseract/data.jsonrecords?${params.toString()}`, {
        headers: {
            Accept: 'application/json',
            'User-Agent': 'rv-val-app/1.0',
        },
    });

    if (!response.ok) return { latest: null, previous: null, latestYear: null as number | null };

    const payload = await response.json();
    const rows = (Array.isArray(payload?.data) ? payload.data : []) as DataUsaTesseractRow[];
    if (rows.length === 0) return { latest: null, previous: null, latestYear: null as number | null };

    const sorted = [...rows].sort((a, b) => {
        const yearA = Number(a?.Year ?? 0);
        const yearB = Number(b?.Year ?? 0);
        return yearB - yearA;
    });

    const latestRow = sorted[0] || null;
    const previousRow = sorted[1] || null;
    const latestValue = latestRow ? toNumber(latestRow?.[measure]) : null;
    const previousValue = previousRow ? toNumber(previousRow?.[measure]) : null;
    const latestYear = latestRow ? Number(latestRow?.Year ?? NaN) : null;

    return {
        latest: latestValue,
        previous: previousValue,
        latestYear: Number.isFinite(latestYear as number) ? (latestYear as number) : null,
    };
};

const fetchDataUsaCountyMetrics = async (countyCode: string) => {
    const [populationSeries, incomeSeries, propertySeries, povertySeries] = await Promise.all([
        fetchSeriesPair('acs_yg_total_population_5', 'Population', countyCode),
        fetchSeriesPair('acs_ygr_median_household_income_race_5', 'Household Income by Race', countyCode),
        fetchSeriesPair('acs_yg_housing_median_value_5', 'Property Value', countyCode),
        fetchSeriesPair('acs_ygpsar_poverty_by_gender_age_race_5', 'Poverty Population', countyCode),
    ]);

    const povertyRate =
        populationSeries.latest && povertySeries.latest
            ? Number(((povertySeries.latest / populationSeries.latest) * 100).toFixed(2))
            : null;

    return {
        population: populationSeries.latest,
        population_change: calculatePercentChange(populationSeries.latest, populationSeries.previous),
        poverty_population: povertySeries.latest,
        poverty_rate: povertyRate,
        median_household_income: incomeSeries.latest,
        median_household_income_change: calculatePercentChange(incomeSeries.latest, incomeSeries.previous),
        median_property_value: propertySeries.latest,
        median_property_value_change: calculatePercentChange(propertySeries.latest, propertySeries.previous),
        year: populationSeries.latestYear ?? incomeSeries.latestYear ?? propertySeries.latestYear ?? null,
    };
};

const fetchLatestViolentCrime = async (countyCode: string) => {
    const params = new URLSearchParams();
    params.set('cube', 'county_health_ranking');
    params.set('drilldowns', 'County,Year');
    params.set('measures', 'Violent Crime');
    params.set('include', `County:${countyCode}`);
    params.set('time', 'Year.latest');

    const response = await fetch(`https://api.datausa.io/tesseract/data.jsonrecords?${params.toString()}`, {
        headers: {
            Accept: 'application/json',
            'User-Agent': 'rv-val-app/1.0',
        },
    });
    if (!response.ok) {
        return { violentCrime: null as number | null, year: null as number | null };
    }

    const payload = await response.json();
    const row = (Array.isArray(payload?.data) ? payload.data[0] : null) as DataUsaTesseractRow | null;
    if (!row) {
        return { violentCrime: null as number | null, year: null as number | null };
    }

    const violentCrime = toNumber(row['Violent Crime']);
    const year = Number(row?.Year ?? NaN);
    return {
        violentCrime,
        year: Number.isFinite(year) ? year : null,
    };
};

const fetchCensusCbpYear = async (stateFips: string, countyFips: string, year: number) => {
    const params = new URLSearchParams();
    params.set('get', 'EMP,ESTAB');
    params.set('for', `county:${countyFips}`);
    params.set('in', `state:${stateFips}`);
    if (process.env.CENSUS_API_KEY) {
        params.set('key', process.env.CENSUS_API_KEY);
    }

    const response = await fetch(`https://api.census.gov/data/${year}/cbp?${params.toString()}`, {
        headers: {
            Accept: 'application/json',
            'User-Agent': 'rv-val-app/1.0',
        },
    });
    if (!response.ok) {
        return { emp: null as number | null, estab: null as number | null };
    }

    const payload = await response.json();
    const rows = Array.isArray(payload) ? payload : [];
    if (rows.length < 2 || !Array.isArray(rows[0]) || !Array.isArray(rows[1])) {
        return { emp: null as number | null, estab: null as number | null };
    }

    const headers = rows[0] as string[];
    const values = rows[1] as string[];
    const empIndex = headers.indexOf('EMP');
    const estabIndex = headers.indexOf('ESTAB');

    return {
        emp: empIndex >= 0 ? toNumber(values[empIndex]) : null,
        estab: estabIndex >= 0 ? toNumber(values[estabIndex]) : null,
    };
};

const fetchCensusBusinessMetrics = async (normalizedFips: string) => {
    const stateFips = normalizedFips.slice(0, 2);
    const countyFips = normalizedFips.slice(2);
    if (!stateFips || !countyFips) {
        return {
            number_of_employees: null as number | null,
            number_of_employees_change: null as number | null,
            number_of_businesses: null as number | null,
            census_business_year: null as number | null,
        };
    }

    const [latest, previous] = await Promise.all([
        fetchCensusCbpYear(stateFips, countyFips, 2022),
        fetchCensusCbpYear(stateFips, countyFips, 2021),
    ]);

    return {
        number_of_employees: latest.emp,
        number_of_employees_change: calculatePercentChange(latest.emp, previous.emp),
        number_of_businesses: latest.estab,
        census_business_year: 2022,
    };
};

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const rawFips = body?.fips_code ?? body?.fips ?? '';
        const digits = String(rawFips).replace(/\D/g, '');

        if (!digits) {
            return NextResponse.json({ error: 'fips_code is required' }, { status: 400 });
        }

        const normalizedFips = digits.padStart(5, '0').slice(-5);
        const countyCode = `05000US${normalizedFips}`;
        const [metrics, crimeMetrics, businessMetrics, hudMetrics] = await Promise.all([
            fetchDataUsaCountyMetrics(countyCode),
            fetchLatestViolentCrime(countyCode),
            fetchCensusBusinessMetrics(normalizedFips),
            lookupHudChas(normalizedFips),
        ]);
        const propertyCrime =
            crimeMetrics.violentCrime === null
                ? null
                : Number((crimeMetrics.violentCrime * PROPERTY_CRIME_FACTOR).toFixed(2));

        const hasAnyValue =
            metrics.population !== null ||
            metrics.poverty_rate !== null ||
            metrics.median_household_income !== null ||
            metrics.median_property_value !== null ||
            crimeMetrics.violentCrime !== null ||
            businessMetrics.number_of_employees !== null ||
            businessMetrics.number_of_businesses !== null ||
            hudMetrics?.eliRenterHouseholds !== null ||
            hudMetrics?.unitsPer100 !== null ||
            hudMetrics?.totalUnits !== null ||
            hudMetrics?.twoBrRent !== null;

        if (!hasAnyValue) {
            return NextResponse.json(
                { message: `No data found for county '${countyCode}'` },
                { status: 404 }
            );
        }

        return NextResponse.json({
            source: 'DataUSA Tesseract + Census CBP + HUD CHAS',
            county_code: countyCode,
            year: metrics.year,
            population: metrics.population,
            population_change: metrics.population_change,
            poverty_population: metrics.poverty_population,
            poverty_rate: metrics.poverty_rate,
            median_household_income: metrics.median_household_income,
            median_household_income_change: metrics.median_household_income_change,
            median_property_value: metrics.median_property_value,
            median_property_value_change: metrics.median_property_value_change,
            violent_crime: crimeMetrics.violentCrime,
            property_crime: propertyCrime,
            crime_year: crimeMetrics.year,
            number_of_employees: businessMetrics.number_of_employees,
            number_of_employees_change: businessMetrics.number_of_employees_change,
            number_of_businesses: businessMetrics.number_of_businesses,
            census_business_year: businessMetrics.census_business_year,
            two_br_rent: hudMetrics?.twoBrRent ?? null,
            eli_renter_households: hudMetrics?.eliRenterHouseholds ?? null,
            units_per_100: hudMetrics?.unitsPer100 ?? null,
            total_units: hudMetrics?.totalUnits ?? null,
        });
    } catch (error) {
        console.error('DataUSA county lookup failed:', error);
        return NextResponse.json(
            { error: 'Failed to fetch county demographics from DataUSA' },
            { status: 500 }
        );
    }
}

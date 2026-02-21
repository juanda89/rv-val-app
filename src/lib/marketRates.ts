export type TreasuryRate = {
    rate: number;
    date: string | null;
};

const FRED_OBSERVATIONS_ENDPOINT = 'https://api.stlouisfed.org/fred/series/observations';

export const fetchFred10YearTreasury = async (): Promise<TreasuryRate | null> => {
    const apiKey = process.env.FRED_APIKEY || process.env.FRED_API_KEY;
    if (!apiKey) {
        return null;
    }

    const params = new URLSearchParams({
        series_id: 'DGS10',
        api_key: apiKey,
        file_type: 'json',
        sort_order: 'desc',
        limit: '20',
    });

    const response = await fetch(`${FRED_OBSERVATIONS_ENDPOINT}?${params.toString()}`, {
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`FRED request failed with status ${response.status}`);
    }

    const payload = await response.json();
    const observations = Array.isArray(payload?.observations) ? payload.observations : [];
    const latest = observations.find((entry: any) => {
        const value = Number(entry?.value);
        return Number.isFinite(value);
    });

    if (!latest) {
        return null;
    }

    return {
        rate: Number(latest.value),
        date: typeof latest.date === 'string' ? latest.date : null,
    };
};

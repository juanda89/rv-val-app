export type TreasuryRate = {
    rate: number;
    date: string | null;
};

const FRED_OBSERVATIONS_ENDPOINT = 'https://api.stlouisfed.org/fred/series/observations';

export class FredTreasuryError extends Error {
    code: 'missing_key' | 'http_error' | 'malformed_response';
    status?: number;

    constructor(
        code: 'missing_key' | 'http_error' | 'malformed_response',
        message: string,
        status?: number
    ) {
        super(message);
        this.name = 'FredTreasuryError';
        this.code = code;
        this.status = status;
    }
}

export const fetchFred10YearTreasury = async (): Promise<TreasuryRate> => {
    const apiKey = process.env.FRED_APIKEY || process.env.FRED_API_KEY;
    if (!apiKey) {
        throw new FredTreasuryError('missing_key', 'FRED_APIKEY is missing.');
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
        throw new FredTreasuryError('http_error', `FRED request failed (status ${response.status}).`, response.status);
    }

    const payload = await response.json();
    const observations = Array.isArray(payload?.observations) ? payload.observations : [];
    if (!Array.isArray(payload?.observations)) {
        throw new FredTreasuryError('malformed_response', 'FRED response malformed: observations array missing.');
    }
    const latest = observations.find((entry: any) => {
        const value = Number(entry?.value);
        return Number.isFinite(value);
    });

    if (!latest) {
        throw new FredTreasuryError('malformed_response', 'FRED response malformed: no numeric 10Y observations.');
    }

    return {
        rate: Number(latest.value),
        date: typeof latest.date === 'string' ? latest.date : null,
    };
};

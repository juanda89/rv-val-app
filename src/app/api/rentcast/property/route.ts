import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const RENTCAST_ENDPOINT = 'https://api.rentcast.io/v1/properties';

const normalizeAddress = (value: string) =>
    value.replace(/,?\s*USA$/i, '').replace(/\s+/g, ' ').trim();

const toNumber = (value: unknown) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(String(value).replace(/[$,]/g, '').trim());
    return Number.isFinite(parsed) ? parsed : null;
};

const getYearValue = (item: Record<string, any>) =>
    item?.year ?? item?.taxYear ?? item?.assessmentYear ?? null;

const normalizeYearItems = (items?: any[] | Record<string, any>) => {
    if (!items) return [];
    if (Array.isArray(items)) return items;
    if (typeof items !== 'object') return [];

    return Object.entries(items).map(([key, value]) => {
        if (value && typeof value === 'object' && getYearValue(value) === null) {
            const parsedYear = Number(key);
            return Number.isFinite(parsedYear) ? { ...value, year: parsedYear } : value;
        }
        return value;
    });
};

const getLatestByYear = (items?: any[] | Record<string, any>) => {
    const normalized = normalizeYearItems(items);
    if (normalized.length === 0) return null;
    const sorted = [...normalized].sort((a, b) => {
        const aYear = getYearValue(a) ?? 0;
        const bYear = getYearValue(b) ?? 0;
        return bYear - aYear;
    });
    return sorted[0];
};

const toAcres = (lotSizeSqft: number | null) => {
    if (!lotSizeSqft) return null;
    return Number((lotSizeSqft / 43560).toFixed(2));
};

export async function POST(req: Request) {
    try {
        const { address } = await req.json();
        if (!address) {
            return NextResponse.json({ error: 'Missing address' }, { status: 400 });
        }

        const apiKey = process.env.RENTCAST_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Missing RENTCAST_API_KEY' }, { status: 500 });
        }

        const fetchProperty = async (queryAddress: string) => {
            const response = await fetch(`${RENTCAST_ENDPOINT}?address=${encodeURIComponent(queryAddress)}`, {
                headers: {
                    'X-Api-Key': apiKey,
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json',
                },
            });
            const payload = await response.json();
            return { response, payload };
        };

        const normalizedAddress = normalizeAddress(String(address));
        const primary = await fetchProperty(String(address));
        let response = primary.response;
        let payload = primary.payload;

        let property = Array.isArray(payload)
            ? payload[0]
            : payload?.properties?.[0] || payload?.property || payload;

        if (response.ok && !property && normalizedAddress && normalizedAddress !== address) {
            const fallback = await fetchProperty(normalizedAddress);
            response = fallback.response;
            payload = fallback.payload;
            property = Array.isArray(payload)
                ? payload[0]
                : payload?.properties?.[0] || payload?.property || payload;
        }

        if (!response.ok) {
            return NextResponse.json(
                { error: payload?.message || 'RentCast request failed' },
                { status: response.status }
            );
        }

        if (!property) {
            return NextResponse.json({ error: 'No property data found' }, { status: 404 });
        }

        const lotSizeSqft = toNumber(property?.lotSize ?? property?.lot_size);
        const acres = toAcres(lotSizeSqft);

        const latestTax = getLatestByYear(property?.propertyTaxes || property?.property_taxes);
        const latestAssessment = getLatestByYear(property?.taxAssessments || property?.tax_assessments);

        const taxAmount = toNumber(latestTax?.total ?? latestTax?.amount ?? latestTax?.taxAmount);
        const assessedValue = toNumber(latestAssessment?.value ?? latestAssessment?.total ?? latestAssessment?.assessedValue);
        const taxYear = getYearValue(latestTax) ?? getYearValue(latestAssessment);

        const millageRate =
            taxAmount !== null && assessedValue !== null && assessedValue !== 0
                ? Number(((taxAmount / assessedValue) * 1000).toFixed(3))
                : null;

        const lastSalePrice = toNumber(property?.lastSalePrice ?? property?.last_sale_price);
        const assessmentRatio =
            assessedValue !== null && lastSalePrice !== null && lastSalePrice !== 0
                ? Number((assessedValue / lastSalePrice).toFixed(3))
                : null;

        return NextResponse.json({
            general: {
                address: property?.address || property?.formattedAddress,
                city: property?.city,
                state: property?.state,
                zipCode: property?.zipCode ?? property?.zip,
                parcelNumber: property?.id || property?.legalDescription || null,
                propertyType: property?.propertyType || property?.propertyTypeCode || null,
                yearBuilt: property?.yearBuilt || null,
                lastSalePrice,
                lastSaleDate: property?.lastSaleDate || null,
                lotSizeSqft,
                acreage: acres,
                county: property?.county || null,
            },
            taxes: {
                taxAmount,
                assessedValue,
                taxYear,
                millageRate,
                assessmentRatio,
            },
        });
    } catch (error: any) {
        console.error('RentCast fetch failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

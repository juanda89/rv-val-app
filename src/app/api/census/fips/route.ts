import { NextResponse } from 'next/server';
import { fetchCountyFips, fetchFipsByCoordinates } from '@/lib/censusFips';

export const runtime = 'nodejs';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const latRaw = body?.lat;
        const lngRaw = body?.lng;
        const lat = typeof latRaw === 'number' ? latRaw : Number(latRaw);
        const lng = typeof lngRaw === 'number' ? lngRaw : Number(lngRaw);
        const state = typeof body?.state === 'string' ? body.state.trim() : '';
        const county = typeof body?.county === 'string' ? body.county.trim() : '';

        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            const fipsCode = await fetchFipsByCoordinates(lat, lng);
            if (!fipsCode) {
                return NextResponse.json(
                    { fips_code: null, message: 'No county GEOID found for coordinates' },
                    { status: 404 }
                );
            }

            return NextResponse.json({
                fips_code: fipsCode,
                source: 'US Census Geocoder (coordinates)',
            });
        }

        if (!state || !county) {
            return NextResponse.json(
                { error: 'lat/lng or state/county are required' },
                { status: 400 }
            );
        }

        const fipsCode = await fetchCountyFips(state, county);
        if (!fipsCode) {
            return NextResponse.json(
                { fips_code: null, message: 'No FIPS match found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ fips_code: fipsCode, source: 'US Census API (state/county)' });
    } catch (error) {
        console.error('Census FIPS lookup failed:', error);
        return NextResponse.json(
            { error: 'Failed to resolve FIPS from Census' },
            { status: 500 }
        );
    }
}

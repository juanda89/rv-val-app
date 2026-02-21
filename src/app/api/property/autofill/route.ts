import { NextResponse } from 'next/server';
import type { ApiProvider } from '@/types/apiProvider';
import type { AutofillContext } from '@/lib/providers/types';
import { autofillWithMelissa } from '@/lib/providers/melissa';
import { autofillWithAttom } from '@/lib/providers/attom';
import { autofillWithRentcast } from '@/lib/providers/rentcast';
import { autofillWithReportAllUsa } from '@/lib/providers/reportallusa';
import { normalizeApn } from '@/lib/providers/utils';
import { fetchFred10YearTreasury, FredTreasuryError } from '@/lib/marketRates';

export const runtime = 'nodejs';

const PROVIDERS: ApiProvider[] = ['melissa', 'attom', 'rentcast', 'reportallusa'];
const PROVIDER_LABELS: Record<ApiProvider, string> = {
    melissa: 'Melissa',
    attom: 'ATTOM',
    rentcast: 'Rentcast',
    reportallusa: 'ReportAllUSA',
};

const toNumber = (value: unknown) => {
    if (value === null || value === undefined || value === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const parseContext = (body: Record<string, any>): AutofillContext => ({
    intent: body?.intent === 'taxes' ? 'taxes' : 'step1',
    address: typeof body?.address === 'string' ? body.address.trim() : undefined,
    apn: normalizeApn(body?.apn) ?? undefined,
    lat: toNumber(body?.lat),
    lng: toNumber(body?.lng),
    fips_code: typeof body?.fips_code === 'string' ? body.fips_code.trim() : typeof body?.fips === 'string' ? body.fips.trim() : undefined,
    county: typeof body?.county === 'string' ? body.county.trim() : undefined,
    city: typeof body?.city === 'string' ? body.city.trim() : undefined,
    state: typeof body?.state === 'string' ? body.state.trim() : undefined,
    zip_code: typeof body?.zip_code === 'string' ? body.zip_code.trim() : undefined,
});

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const provider = String(body?.provider || '').toLowerCase() as ApiProvider;

        if (!PROVIDERS.includes(provider)) {
            return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
        }

        const context = parseContext(body || {});
        if (context.intent === 'taxes' && !context.apn) {
            return NextResponse.json({
                apn_found: false,
                apn_lookup_source: null,
                apn_value: null,
                assessor_id: null,
                property_identity: {},
                financials: {},
                demographics_economics: {},
                housing_crisis_metrics: {},
                demographics_details: null,
                api_snapshot: {},
                source_provider: provider,
                message: 'APN is required for taxes auto-fill.',
            }, { status: 200 });
        }
        if (!context.apn && !context.address && (!Number.isFinite(context.lat) || !Number.isFinite(context.lng))) {
            return NextResponse.json(
                { error: 'apn, address or lat/lng are required' },
                { status: 400 }
            );
        }

        const requestOrigin = new URL(req.url).origin;

        let result =
            provider === 'melissa'
                ? await autofillWithMelissa(context)
                : provider === 'attom'
                    ? await autofillWithAttom(context, requestOrigin)
                    : provider === 'rentcast'
                        ? await autofillWithRentcast(context)
                        : await autofillWithReportAllUsa(context);

        let fredStatusMessage = '';
        if (context.intent === 'taxes') {
            try {
                const treasury10Year = await fetchFred10YearTreasury();
                result = {
                    ...result,
                    financials: {
                        ...result.financials,
                        us_10_year_treasury: treasury10Year.rate,
                        us_10_year_treasury_date: treasury10Year.date,
                    },
                    api_snapshot: {
                        ...(result.api_snapshot || {}),
                        us_10_year_treasury: treasury10Year.rate,
                    },
                };
                fredStatusMessage = '10Y Treasury loaded from FRED (DGS10).';
            } catch (fredError) {
                console.warn('FRED 10Y fetch failed:', fredError);
                const fredMessage =
                    fredError instanceof FredTreasuryError
                        ? fredError.message
                        : 'FRED unknown error.';
                fredStatusMessage = `10Y Treasury not loaded: ${fredMessage}`;
            }

            const financials = result.financials || {};
            const hasProviderTaxFields = [
                financials.assessed_value,
                financials.market_value,
                financials.tax_amount,
                financials.tax_prev_year_amount,
                financials.tax_year,
                financials.millage_rate,
                financials.assessment_ratio,
            ].some((value) => value !== null && value !== undefined);

            const providerMessage =
                typeof result.message === 'string' && result.message.trim().length > 0
                    ? result.message.trim()
                    : '';
            let taxMessage = '';
            if (!result.apn_found) {
                taxMessage = providerMessage || `${PROVIDER_LABELS[provider]}: unable to locate property tax records for this property.`;
            } else if (hasProviderTaxFields) {
                taxMessage = providerMessage || `${PROVIDER_LABELS[provider]}: tax financial fields loaded successfully.`;
            } else {
                taxMessage = providerMessage || `${PROVIDER_LABELS[provider]}: property found, but provider did not return tax financial fields.`;
            }

            result = {
                ...result,
                message: fredStatusMessage ? `${taxMessage} ${fredStatusMessage}` : taxMessage,
            };
        }

        return NextResponse.json(result, {
            status: result.apn_found ? 200 : 200,
        });
    } catch (error: any) {
        console.error('Property autofill failed:', error);
        return NextResponse.json(
            { error: error?.message || 'Property autofill failed' },
            { status: 500 }
        );
    }
}

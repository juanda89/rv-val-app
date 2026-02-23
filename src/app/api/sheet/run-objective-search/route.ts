import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const FUNCTION_NAME = 'ajustarObjetivoInterno';
const WEBAPP_URL = process.env.GOOGLE_APPS_SCRIPT_WEBAPP_URL?.trim() || '';
const WEBHOOK_SECRET = process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_SECRET?.trim() || '';
const WEBAPP_TIMEOUT_MS = 120_000;

const parseJsonSafe = async (response: Response) => {
    const text = await response.text();
    if (!text.trim()) return {};
    try {
        return JSON.parse(text);
    } catch {
        return { __invalidJson: true, raw: text };
    }
};

export async function POST(req: Request) {
    try {
        const { projectId } = await req.json();
        if (!projectId) {
            return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
        }

        if (!WEBAPP_URL) {
            return NextResponse.json(
                { error: 'Missing GOOGLE_APPS_SCRIPT_WEBAPP_URL configuration.' },
                { status: 500 }
            );
        }

        if (!WEBHOOK_SECRET) {
            return NextResponse.json(
                { error: 'Missing GOOGLE_APPS_SCRIPT_WEBHOOK_SECRET configuration.' },
                { status: 500 }
            );
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                global: {
                    headers: {
                        Authorization: req.headers.get('Authorization') ?? '',
                    },
                },
            }
        );

        const { data: project, error } = await supabase
            .from('projects')
            .select('spreadsheet_id')
            .eq('id', projectId)
            .single();

        if (error || !project?.spreadsheet_id) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const spreadsheetId = project.spreadsheet_id;
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), WEBAPP_TIMEOUT_MS);

        let webAppResponse: Response;
        try {
            webAppResponse = await fetch(WEBAPP_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    spreadsheetId,
                    secret: WEBHOOK_SECRET,
                }),
                signal: abortController.signal,
                cache: 'no-store',
            });
        } catch (fetchError: any) {
            if (fetchError?.name === 'AbortError') {
                return NextResponse.json(
                    {
                        error: `Apps Script Web App timeout after ${Math.round(
                            WEBAPP_TIMEOUT_MS / 1000
                        )} seconds.`,
                    },
                    { status: 504 }
                );
            }
            console.error('Run objective search webapp request failed:', fetchError);
            return NextResponse.json(
                { error: 'Failed to call Apps Script Web App.' },
                { status: 502 }
            );
        } finally {
            clearTimeout(timeoutId);
        }

        const payload = await parseJsonSafe(webAppResponse);
        const payloadStatus =
            typeof payload?.status === 'string' ? payload.status.trim().toLowerCase() : '';
        const webAppSuccess = payload?.ok === true || payloadStatus === 'success';
        const webAppFailure =
            payload?.ok === false || payloadStatus === 'error' || payloadStatus === 'failed';

        if (!webAppResponse.ok) {
            if (webAppResponse.status === 401 || webAppResponse.status === 403) {
                return NextResponse.json(
                    {
                        error:
                            payload?.error ||
                            'Apps Script Web App authorization failed. Verify deploy access and webhook secret.',
                    },
                    { status: 500 }
                );
            }
            if (webAppResponse.status === 404) {
                return NextResponse.json(
                    {
                        error:
                            payload?.error ||
                            'Apps Script Web App endpoint not found. Verify GOOGLE_APPS_SCRIPT_WEBAPP_URL.',
                    },
                    { status: 500 }
                );
            }
            return NextResponse.json(
                {
                    error:
                        payload?.error ||
                        `Apps Script Web App failed with status ${webAppResponse.status}.`,
                },
                { status: 500 }
            );
        }

        if (webAppFailure) {
            return NextResponse.json(
                {
                    error:
                        payload?.error ||
                        payload?.message ||
                        payload?.data?.error ||
                        'Apps Script Web App returned an execution error.',
                },
                { status: 500 }
            );
        }

        if (
            !payload ||
            typeof payload !== 'object' ||
            Array.isArray(payload) ||
            !webAppSuccess
        ) {
            return NextResponse.json(
                {
                    error:
                        'Apps Script Web App returned an invalid response. Expected JSON with ok=true or status=success.',
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            ok: true,
            spreadsheetId,
            functionName: payload?.functionName || payload?.data?.functionName || FUNCTION_NAME,
            scriptSource: 'webapp',
            result: payload?.result ?? payload?.data ?? null,
        });
    } catch (error: any) {
        console.error('Run objective search failed:', error);
        return NextResponse.json(
            { error: error?.message || 'Failed to run objective search' },
            { status: 500 }
        );
    }
}

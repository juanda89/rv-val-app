import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getDriveClientWithEnvOAuth, getScriptClientWithEnvOAuth } from '@/lib/google';

const SCRIPT_MIME_TYPE = 'application/vnd.google-apps.script';
const FUNCTION_NAME = 'ejecutarBusquedaObjetivoProporcional';

const extractScriptError = (errorPayload: any) => {
    const details = Array.isArray(errorPayload?.details) ? errorPayload.details : [];
    const executionError = details.find((detail: any) => detail?.errorMessage);
    if (executionError?.errorMessage) {
        return executionError.errorMessage as string;
    }
    if (typeof errorPayload?.message === 'string' && errorPayload.message.trim()) {
        return errorPayload.message.trim();
    }
    return 'Apps Script execution failed.';
};

export async function POST(req: Request) {
    try {
        const { projectId } = await req.json();
        if (!projectId) {
            return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
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
        const drive = await getDriveClientWithEnvOAuth(req);

        const scriptsInSpreadsheet = await drive.files.list({
            q: `'${spreadsheetId}' in parents and mimeType='${SCRIPT_MIME_TYPE}' and trashed=false`,
            fields: 'files(id,name)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            pageSize: 10,
        });

        const scriptFile = scriptsInSpreadsheet.data.files?.[0];
        if (!scriptFile?.id) {
            return NextResponse.json(
                { error: 'No Apps Script project found in this spreadsheet copy.' },
                { status: 404 }
            );
        }

        const scripts = await getScriptClientWithEnvOAuth(req);
        const runResponse = await scripts.scripts.run({
            scriptId: scriptFile.id,
            requestBody: {
                function: FUNCTION_NAME,
                devMode: false,
            },
        });

        const executionError = runResponse.data.error;
        if (executionError) {
            const message = extractScriptError(executionError);
            return NextResponse.json({ error: message }, { status: 500 });
        }

        return NextResponse.json({
            ok: true,
            spreadsheetId,
            scriptId: scriptFile.id,
            functionName: FUNCTION_NAME,
            result: runResponse.data.response?.result ?? null,
        });
    } catch (error: any) {
        console.error('Run objective search failed:', error);
        return NextResponse.json(
            { error: error?.message || 'Failed to run objective search' },
            { status: 500 }
        );
    }
}

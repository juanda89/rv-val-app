import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getDriveClientWithEnvOAuth } from '@/lib/google';

export const runtime = 'nodejs';

const sanitizeBaseName = (value: string) =>
    value
        .replace(/[^a-zA-Z0-9-_ ]+/g, '')
        .trim() || 'valuation-report';

const toTimestamp = () => {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

const extractDriveDiagnostics = (error: any) => {
    const status = error?.status ?? error?.code ?? error?.response?.status ?? null;
    const reason =
        error?.response?.data?.error?.errors?.[0]?.reason ??
        error?.errors?.[0]?.reason ??
        null;
    const message =
        error?.response?.data?.error?.message ??
        error?.message ??
        null;
    return { status, reason, message };
};

const mapDriveError = ({
    diagnostics,
    stage,
    hasFolderId,
}: {
    diagnostics: { status: any; reason: string | null; message: string | null };
    stage: 'source' | 'folder' | 'copy' | 'export';
    hasFolderId: boolean;
}) => {
    const reason = diagnostics.reason;
    const message = String(diagnostics.message || '').toLowerCase();

    if (message.includes('google oauth credentials not configured')) {
        return 'Google OAuth credentials not configured';
    }
    if (reason === 'invalidGrant' || reason === 'invalid_grant' || message.includes('invalid_grant')) {
        return 'Google OAuth refresh token invalid or revoked';
    }
    if (reason === 'storageQuotaExceeded') {
        return 'OAuth account Drive storage quota exceeded';
    }
    if (reason === 'insufficientFilePermissions' || reason === 'insufficientPermissions' || reason === 'forbidden') {
        if (stage === 'folder') return 'OAuth account lacks permission to destination folder';
        if (stage === 'source') return 'OAuth account lacks permission to access source spreadsheet';
        return 'OAuth account lacks required Drive permissions';
    }
    if (reason === 'notFound') {
        if (stage === 'folder' && hasFolderId) return 'Destination folder not found or not accessible by OAuth account';
        if (stage === 'source') return 'Source spreadsheet not found or not accessible by OAuth account';
        return 'Requested Google Drive file was not found';
    }
    if (stage === 'export') {
        return 'Failed to export report as Excel';
    }
    if (stage === 'copy') {
        return 'Failed to create Google Sheets copy';
    }
    return diagnostics.message || 'Google Drive request failed';
};

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const spreadsheetId = searchParams.get('spreadsheetId');
        const projectId = searchParams.get('projectId');
        const fileNameParam = searchParams.get('fileName') || 'valuation-report';
        const formatParam = (searchParams.get('format') || 'excel').toLowerCase();
        const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();

        if (!spreadsheetId) {
            return NextResponse.json({ error: 'Missing spreadsheetId' }, { status: 400 });
        }
        if (formatParam !== 'excel' && formatParam !== 'sheets') {
            return NextResponse.json({ error: 'Invalid format. Use "excel" or "sheets".' }, { status: 400 });
        }

        const drive = await getDriveClientWithEnvOAuth(req);
        let sourceSpreadsheetId = spreadsheetId;
        let projectForCopy: {
            id: string;
            spreadsheet_id: string;
            report_copy_spreadsheet_id: string | null;
            report_copy_url: string | null;
        } | null = null;
        let supabase: ReturnType<typeof createClient> | null = null;

        if (projectId) {
            supabase = createClient(
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

            const { data: authData, error: authError } = await supabase.auth.getUser();
            if (authError || !authData?.user) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }

            const projectsTable = supabase.from('projects') as any;

            const { data: projectData, error: projectError } = await projectsTable
                .select('id, spreadsheet_id, report_copy_spreadsheet_id, report_copy_url')
                .eq('id', projectId)
                .single();
            const project = projectData as {
                id: string;
                spreadsheet_id: string;
                report_copy_spreadsheet_id: string | null;
                report_copy_url: string | null;
            } | null;

            if (projectError || !project?.spreadsheet_id) {
                return NextResponse.json({ error: 'Project not found' }, { status: 404 });
            }

            sourceSpreadsheetId = project.spreadsheet_id;
            projectForCopy = project;
        }

        if (formatParam === 'sheets') {
            if (projectForCopy?.report_copy_spreadsheet_id && projectForCopy?.report_copy_url) {
                try {
                    await drive.files.get({
                        fileId: projectForCopy.report_copy_spreadsheet_id,
                        supportsAllDrives: true,
                        fields: 'id',
                    });
                    return NextResponse.json({
                        ok: true,
                        spreadsheetId: projectForCopy.report_copy_spreadsheet_id,
                        url: projectForCopy.report_copy_url,
                        reused: true,
                    });
                } catch {
                    // stale or inaccessible cached copy; fall through to create a new one
                }
            }

            try {
                await drive.files.get({
                    fileId: sourceSpreadsheetId,
                    supportsAllDrives: true,
                    fields: 'id,name,mimeType',
                });
            } catch (error: any) {
                const diagnostics = extractDriveDiagnostics(error);
                return NextResponse.json(
                    { error: mapDriveError({ diagnostics, stage: 'source', hasFolderId: Boolean(driveFolderId) }) },
                    { status: 500 }
                );
            }

            if (driveFolderId) {
                try {
                    await drive.files.get({
                        fileId: driveFolderId,
                        supportsAllDrives: true,
                        fields: 'id,name,mimeType',
                    });
                } catch (error: any) {
                    const diagnostics = extractDriveDiagnostics(error);
                    return NextResponse.json(
                        { error: mapDriveError({ diagnostics, stage: 'folder', hasFolderId: true }) },
                        { status: 500 }
                    );
                }
            }

            const copyName = `${sanitizeBaseName(fileNameParam)} - ${toTimestamp()}`;

            try {
                const copied = await drive.files.copy({
                    fileId: sourceSpreadsheetId,
                    supportsAllDrives: true,
                    fields: 'id,name',
                    requestBody: {
                        name: copyName,
                        mimeType: 'application/vnd.google-apps.spreadsheet',
                        ...(driveFolderId ? { parents: [driveFolderId] } : {}),
                    },
                });

                const copiedId = copied.data.id;
                if (!copiedId) {
                    return NextResponse.json({ error: 'Failed to create Google Sheets copy' }, { status: 500 });
                }

                const copiedUrl = `https://docs.google.com/spreadsheets/d/${copiedId}/edit`;

                if (supabase && projectForCopy) {
                    const projectsTable = supabase.from('projects') as any;
                    const { error: updateError } = await projectsTable
                        .update({
                            report_copy_spreadsheet_id: copiedId,
                            report_copy_url: copiedUrl,
                            report_copy_created_at: new Date().toISOString(),
                        })
                        .eq('id', projectForCopy.id);

                    if (updateError) {
                        console.warn('Failed to persist report copy url in project:', updateError);
                    }
                }

                return NextResponse.json({
                    ok: true,
                    spreadsheetId: copiedId,
                    url: copiedUrl,
                    name: copied.data.name || copyName,
                });
            } catch (error: any) {
                const diagnostics = extractDriveDiagnostics(error);
                return NextResponse.json(
                    { error: mapDriveError({ diagnostics, stage: 'copy', hasFolderId: Boolean(driveFolderId) }) },
                    { status: 500 }
                );
            }
        }

        try {
            const exportResponse = await drive.files.export(
                {
                    fileId: sourceSpreadsheetId,
                    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                },
                {
                    responseType: 'arraybuffer',
                }
            );

            const data = Buffer.from(exportResponse.data as ArrayBuffer);
            const baseName = sanitizeBaseName(fileNameParam);
            const fileName = baseName.endsWith('.xlsx') ? baseName : `${baseName}.xlsx`;

            return new NextResponse(data, {
                status: 200,
                headers: {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': `attachment; filename="${fileName}"`,
                    'Cache-Control': 'no-store',
                },
            });
        } catch (error: any) {
            const diagnostics = extractDriveDiagnostics(error);
            return NextResponse.json(
                { error: mapDriveError({ diagnostics, stage: 'export', hasFolderId: Boolean(driveFolderId) }) },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error('Report download failed:', error);
        return NextResponse.json(
            { error: error?.message || 'Failed to download report' },
            { status: 500 }
        );
    }
}

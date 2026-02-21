import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getDriveClientWithEnvOAuth, getSheetsClient } from '@/lib/google';

const applyDefaultValues = async (spreadsheetId: string) => {
    const sheets = await getSheetsClient();
    const inputSheetName = 'Input Fields';

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${inputSheetName}'!B2:D500`,
    });

    const updates: { range: string; values: any[][] }[] = [];
    const rows = response.data.values || [];

    rows.forEach((row, index) => {
        const label = String(row?.[0] ?? '').trim();
        if (!label) return;
        const currentValue = row?.[1];
        const defaultValue = row?.[2];
        if (
            (currentValue === undefined || currentValue === null || currentValue === '') &&
            defaultValue !== undefined &&
            defaultValue !== null &&
            defaultValue !== ''
        ) {
            const rowNumber = index + 2;
            updates.push({
                range: `'${inputSheetName}'!C${rowNumber}`,
                values: [[defaultValue]],
            });
        }
    });

    if (updates.length > 0) {
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: {
                data: updates,
                valueInputOption: 'USER_ENTERED',
            },
        });
    }
};

const extractDriveDiagnostics = (error: any) => {
    const status =
        error?.status ??
        error?.code ??
        error?.response?.status ??
        null;
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

const isPermissionReason = (reason: string | null) =>
    reason === 'insufficientFilePermissions' ||
    reason === 'insufficientPermissions' ||
    reason === 'forbidden';

const duplicateMasterSheet = async (fileName: string, req: Request) => {
    const masterSheetId = process.env.MASTER_SHEET_ID?.trim();
    const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
    const oauthClientId = process.env.GOOGLE_CLIENT_ID?.trim() || null;

    if (!masterSheetId) {
        throw new Error('MASTER_SHEET_ID not configured');
    }

    const copiedFile = await (async () => {
        try {
            const drive = await getDriveClientWithEnvOAuth(req);
            const response = await drive.files.copy({
                fileId: masterSheetId,
                supportsAllDrives: true,
                fields: 'id,name',
                requestBody: {
                    name: fileName,
                    mimeType: 'application/vnd.google-apps.spreadsheet',
                    ...(driveFolderId ? { parents: [driveFolderId] } : {}),
                },
            });
            return response.data;
        } catch (error: any) {
            const diagnostics = extractDriveDiagnostics(error);
            console.error('Drive copy failed', {
                operation: 'copy',
                masterSheetId,
                folderId: driveFolderId,
                oauthClientId,
                ...diagnostics,
            });
            if (error?.message === 'Google OAuth credentials not configured') {
                throw error;
            }
            if (diagnostics.reason === 'invalidGrant' || diagnostics.reason === 'invalid_grant' || String(diagnostics.message || '').toLowerCase().includes('invalid_grant')) {
                throw new Error('Google OAuth refresh token invalid or revoked');
            }
            if (diagnostics.reason === 'storageQuotaExceeded') {
                throw new Error('OAuth account Drive storage quota exceeded');
            }
            if (isPermissionReason(diagnostics.reason)) {
                throw new Error('OAuth account lacks permission to access/copy master file');
            }
            if (diagnostics.reason === 'notFound') {
                throw new Error('MASTER_SHEET_ID not accessible by OAuth account');
            }
            throw new Error('Unable to duplicate master sheet with configured OAuth account');
        }
    })();

    const spreadsheetId = copiedFile.id;
    if (!spreadsheetId) {
        throw new Error('Unable to duplicate master sheet with configured OAuth account');
    }

    return spreadsheetId;
};

export async function POST(req: Request) {
    try {
        const { name, address, user_id } = await req.json();

        if (!name || !user_id) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Create Supabase client with Auth context
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

        // Get user's email for sharing the sheet
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({
                error: 'Could not get user',
                details: userError
            }, { status: 401 });
        }

        // Duplicate master sheet directly with Google Drive API (env OAuth credentials)
        const fileName = `[APP] ${name}`;
        const spreadsheetId = await duplicateMasterSheet(fileName, req);

        try {
            await applyDefaultValues(spreadsheetId);
        } catch (defaultsError) {
            console.warn('Failed to apply default values from column D:', defaultsError);
        }

        // Insert into Supabase
        const { data, error } = await supabase
            .from('projects')
            .insert({
                user_id,
                name,
                address,
                spreadsheet_id: spreadsheetId,
            })
            .select()
            .single();

        if (error) {
            console.error('Supabase insert error:', error);
            throw error;
        }

        console.log('Project created successfully:', data);

        return NextResponse.json({ project: data });
    } catch (error: any) {
        console.error('Project creation failed', {
            masterSheetId: process.env.MASTER_SHEET_ID?.trim() || null,
            folderId: process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() || null,
            oauthClientId: process.env.GOOGLE_CLIENT_ID?.trim() || null,
            operation: 'copy',
            errorMessage: error?.message || null,
            driveStatus: error?.status ?? error?.code ?? error?.response?.status ?? null,
            driveReason: error?.response?.data?.error?.errors?.[0]?.reason ?? error?.errors?.[0]?.reason ?? null,
        });
        return NextResponse.json({
            error: error.message || 'Unknown error',
            details: error
        }, { status: 500 });
    }
}

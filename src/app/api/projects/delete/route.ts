import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getDriveClientWithEnvOAuth } from '@/lib/google';

const isGoogleNotFound = (error: any) =>
    error?.code === 404 || error?.status === 404 || error?.response?.status === 404;

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
            .select('id, spreadsheet_id')
            .eq('id', projectId)
            .single();

        if (error || !project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        if (project.spreadsheet_id) {
            try {
                const drive = await getDriveClientWithEnvOAuth(req);
                await drive.files.delete({
                    fileId: project.spreadsheet_id,
                    supportsAllDrives: true,
                });
            } catch (driveError: any) {
                const reason = driveError?.response?.data?.error?.errors?.[0]?.reason ?? driveError?.errors?.[0]?.reason ?? null;
                const message = driveError?.response?.data?.error?.message ?? driveError?.message ?? null;
                if (
                    driveError?.message === 'Google OAuth credentials not configured'
                ) {
                    return NextResponse.json(
                        { error: 'Google OAuth credentials not configured' },
                        { status: 500 }
                    );
                }
                if (
                    reason === 'invalidGrant' ||
                    reason === 'invalid_grant' ||
                    String(message || '').toLowerCase().includes('invalid_grant')
                ) {
                    return NextResponse.json(
                        { error: 'Google OAuth refresh token invalid or revoked' },
                        { status: 500 }
                    );
                }
                if (!isGoogleNotFound(driveError)) {
                    console.error('Drive delete failed', {
                        operation: 'delete',
                        spreadsheetId: project.spreadsheet_id,
                        folderId: process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() || null,
                        oauthClientId: process.env.GOOGLE_CLIENT_ID?.trim() || null,
                        driveReason: reason,
                        driveStatus: driveError?.status ?? driveError?.code ?? driveError?.response?.status ?? null,
                        errorMessage: message,
                    });
                    return NextResponse.json(
                        { error: 'Failed to delete Drive file', details: driveError?.message || driveError },
                        { status: 500 }
                    );
                }
            }
        }

        const { error: deleteError } = await supabase
            .from('projects')
            .delete()
            .eq('id', projectId);

        if (deleteError) {
            return NextResponse.json({ error: deleteError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Project delete failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

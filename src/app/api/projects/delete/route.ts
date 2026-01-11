import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getDriveClient } from '@/lib/google';

const isNotFoundError = (error: any) => {
    const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
    return error?.code === 404 || message.includes('not found');
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
            .select('id, spreadsheet_id')
            .eq('id', projectId)
            .single();

        if (error || !project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        if (project.spreadsheet_id) {
            try {
                const drive = await getDriveClient();
                await drive.files.delete({ fileId: project.spreadsheet_id });
            } catch (driveError: any) {
                if (!isNotFoundError(driveError)) {
                    return NextResponse.json(
                        { error: 'Failed to delete Drive file' },
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

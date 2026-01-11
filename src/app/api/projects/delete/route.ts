import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
            const webhookUrl = 'https://n8n-boominbm-u44048.vm.elestio.app/webhook/delete-file';
            const webhookResponse = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ fileId: project.spreadsheet_id }),
            });

            if (!webhookResponse.ok) {
                const errorText = await webhookResponse.text();
                return NextResponse.json(
                    { error: 'Failed to delete Drive file', details: errorText },
                    { status: 500 }
                );
            }

            const webhookData = await webhookResponse.json().catch(() => ({}));
            const success =
                webhookData?.success === true ||
                webhookData?.success === 'true';
            const deleted =
                webhookData?.deleted === true ||
                webhookData?.status === 'deleted';

            if (!success && !deleted) {
                return NextResponse.json(
                    { error: 'Failed to delete Drive file', details: webhookData },
                    { status: 500 }
                );
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

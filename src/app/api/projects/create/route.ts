import { NextResponse } from 'next/server';
import { getDriveClient } from '@/lib/google';
import { createClient } from '@supabase/supabase-js';

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

        const drive = await getDriveClient();
        const MASTER_ID = process.env.MASTER_SHEET_ID;

        if (!MASTER_ID) throw new Error('MASTER_SHEET_ID not defined');

        // 1. Copy Sheet
        const copy = await drive.files.copy({
            fileId: MASTER_ID,
            requestBody: {
                name: `[APP] ${name} - ${user_id}`,
            },
        });

        const spreadsheetId = copy.data.id;
        if (!spreadsheetId) throw new Error('Failed to copy sheet');

        // 2. Insert into Supabase
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
            // Cleanup: Delete the sheet if DB insert fails? (Optional improvement)
            throw error;
        }

        return NextResponse.json({ project: data });
    } catch (error: any) {
        console.error('Project creation failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

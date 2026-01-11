import { NextResponse } from 'next/server';
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

        // Get user's email for sharing the sheet
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({
                error: 'Could not get user',
                details: userError
            }, { status: 401 });
        }

        // Call n8n webhook to duplicate master file
        const webhookUrl = 'https://n8n-boominbm-u44048.vm.elestio.app/webhook/duplicate-master-file';
        const fileName = `[APP] ${name}`;
        const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

        if (!serviceAccountEmail) {
            throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL not configured');
        }

        console.log('Calling n8n webhook:', { fileName, email: serviceAccountEmail });

        const webhookResponse = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fileName: fileName,
                email: serviceAccountEmail
            })
        });

        if (!webhookResponse.ok) {
            const errorText = await webhookResponse.text();
            throw new Error(`Webhook failed: ${webhookResponse.status} - ${errorText}`);
        }

        const webhookData = await webhookResponse.json();
        console.log('Webhook response:', webhookData);

        const spreadsheetId = webhookData.fileId || webhookData.id || webhookData.spreadsheetId;

        if (!spreadsheetId) {
            throw new Error('Webhook did not return a file ID');
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
        console.error('Project creation failed:', error);
        return NextResponse.json({
            error: error.message || 'Unknown error',
            details: error
        }, { status: 500 });
    }
}

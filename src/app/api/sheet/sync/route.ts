import { NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/google';
import { supabase } from '@/lib/supabaseClient';
import { SHEET_MAPPING } from '@/config/sheetMapping';

export async function POST(req: Request) {
    try {
        const { projectId, inputs } = await req.json();
        if (!projectId || !inputs) return NextResponse.json({ error: 'Missing data' }, { status: 400 });

        // 1. Get Project's Spreadsheet ID
        const { data: project, error } = await supabase
            .from('projects')
            .select('spreadsheet_id')
            .eq('id', projectId)
            .single();

        if (error || !project) throw new Error('Project not found');

        const sheets = await getSheetsClient();
        const spreadsheetId = project.spreadsheet_id;

        // 2. Prepare Updates
        const updates = [];
        for (const [key, value] of Object.entries(inputs)) {
            // Cast key to check if it exists in mapping
            const mappingKey = key as keyof typeof SHEET_MAPPING.inputs;
            const cell = SHEET_MAPPING.inputs[mappingKey];

            if (cell) {
                updates.push({
                    range: `Sheet1!${cell}`, // Assuming Sheet1. Ideally this should be configurable.
                    values: [[value]],
                });
            }
        }

        if (updates.length > 0) {
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId,
                requestBody: {
                    data: updates,
                    valueInputOption: 'USER_ENTERED',
                },
            });
        }

        // 3. Read Outputs
        const outputKeys = Object.keys(SHEET_MAPPING.outputs);
        const ranges = Object.values(SHEET_MAPPING.outputs).map(cell => `Sheet1!${cell}`);

        const response = await sheets.spreadsheets.values.batchGet({
            spreadsheetId,
            ranges,
        });

        const results: Record<string, any> = {};
        if (response.data.valueRanges) {
            response.data.valueRanges.forEach((range, index) => {
                const key = outputKeys[index];
                const val = range.values?.[0]?.[0]; // Get the single cell value
                results[key] = val;
            });
        }

        return NextResponse.json({ results });

    } catch (error: any) {
        console.error('Sync failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

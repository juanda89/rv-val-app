import { NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/google';
import { createClient } from '@supabase/supabase-js';
import { SHEET_MAPPING } from '@/config/sheetMapping';

export async function POST(req: Request) {
    try {
        const { projectId, inputs } = await req.json();
        if (!projectId || !inputs) return NextResponse.json({ error: 'Missing data' }, { status: 400 });

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

        // 1. Get Project's Spreadsheet ID
        const { data: project, error } = await supabase
            .from('projects')
            .select('spreadsheet_id, name, address')
            .eq('id', projectId)
            .single();

        if (error || !project) throw new Error('Project not found');

        const sheets = await getSheetsClient();
        const spreadsheetId = project.spreadsheet_id;

        // 2. Prepare Updates
        const updates = [];
        const inputSheetName = SHEET_MAPPING.inputs.sheetName;

        const extractCityFromAddress = (address: string) => {
            const parts = address
                .split(',')
                .map(part => part.trim())
                .filter(Boolean);

            if (parts.length >= 3) return parts[1];
            if (parts.length === 2) return parts[0];
            return '';
        };

        const normalizeString = (value: unknown) => {
            if (typeof value !== 'string') return '';
            return value.trim();
        };

        const projectName = normalizeString(inputs.name) || project.name || '';
        const projectAddress = normalizeString(inputs.address) || project.address || '';
        const projectCity = normalizeString(inputs.city) || extractCityFromAddress(projectAddress);

        const mergedInputs = {
            ...inputs,
            name: projectName,
            city: projectCity,
            address: projectAddress,
        };

        const metadataLabels = ['name', 'city', 'address'];
        metadataLabels.forEach((label, index) => {
            const row = 2 + index;
            updates.push({
                range: `'${inputSheetName}'!B${row}`,
                values: [[label]],
            });
        });

        for (const [key, value] of Object.entries(mergedInputs)) {
            // Cast key to check if it exists in mapping
            const mappingKey = key as keyof typeof SHEET_MAPPING.inputs;
            const cell = SHEET_MAPPING.inputs[mappingKey];

            if (cell && mappingKey !== 'sheetName') {
                updates.push({
                    range: `'${inputSheetName}'!${cell}`,
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
        const outputSheetName = SHEET_MAPPING.outputs.sheetName;
        const outputKeys = Object.keys(SHEET_MAPPING.outputs).filter(k => k !== 'sheetName');
        const ranges = outputKeys.map(key => {
            const cell = SHEET_MAPPING.outputs[key as keyof typeof SHEET_MAPPING.outputs];
            return `'${outputSheetName}'!${cell}`;
        });

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

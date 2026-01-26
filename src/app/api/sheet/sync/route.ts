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

        const normalizeString = (value: unknown) => {
            if (typeof value !== 'string') return '';
            return value.trim();
        };

        const projectName = normalizeString(inputs.name) || project.name || '';
        const projectAddress = normalizeString(inputs.address) || project.address || '';
        const projectCity = normalizeString(inputs.city) || '';
        const pdfValues = inputs.__pdf_values || inputs.pdf_values || {};

        const mergedInputs: Record<string, any> = { ...inputs };
        if (projectName) mergedInputs.name = projectName;
        if (projectAddress) mergedInputs.address = projectAddress;
        if (projectCity) mergedInputs.city = projectCity;

        const getRowFromCell = (cell: string) => {
            const match = cell.match(/\d+$/);
            return match ? Number(match[0]) : 0;
        };

        const inputKeys = Object.keys(SHEET_MAPPING.inputs).filter(k => k !== 'sheetName');
        inputKeys.forEach(key => {
            const cell = SHEET_MAPPING.inputs[key as keyof typeof SHEET_MAPPING.inputs];
            const row = getRowFromCell(cell);
            if (!row) return;
            updates.push({
                range: `'${inputSheetName}'!B${row}`,
                values: [[key]],
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

        if (pdfValues && typeof pdfValues === 'object') {
            for (const [key, value] of Object.entries(pdfValues)) {
                const mappingKey = key as keyof typeof SHEET_MAPPING.inputs;
                const cell = SHEET_MAPPING.inputs[mappingKey];
                if (!cell || mappingKey === 'sheetName') continue;
                const row = getRowFromCell(cell);
                if (!row) continue;
                updates.push({
                    range: `'${inputSheetName}'!D${row}`,
                    values: [[value]],
                });
            }
        }

        const outputSheetName = SHEET_MAPPING.outputs.sheetName;
        const outputKeys = Object.keys(SHEET_MAPPING.outputs).filter(k => k !== 'sheetName');

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
        const ranges = outputKeys.map(key => {
            const cell = SHEET_MAPPING.outputs[key as keyof typeof SHEET_MAPPING.outputs];
            return `'${outputSheetName}'!${cell}`;
        });

        const labelRange = `'${outputSheetName}'!B2:C300`;
        const response = await sheets.spreadsheets.values.batchGet({
            spreadsheetId,
            ranges: [...ranges, labelRange],
        });

        const results: Record<string, any> = {};
        const valueRanges = response.data.valueRanges || [];
        valueRanges.slice(0, outputKeys.length).forEach((range, index) => {
            const key = outputKeys[index];
            const val = range.values?.[0]?.[0];
            results[key] = val;
        });

        const labelValues: Record<string, any> = {};
        const labelRows = valueRanges[outputKeys.length]?.values || [];
        labelRows.forEach((row: any[]) => {
            const rawLabel = String(row?.[0] ?? '').trim();
            if (!rawLabel) return;
            const normalized = rawLabel
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_+|_+$/g, '');
            labelValues[normalized] = row?.[1];
        });
        results.__labels = labelValues;

        return NextResponse.json({ results });

    } catch (error: any) {
        console.error('Sync failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

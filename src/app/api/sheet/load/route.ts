import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSheetsClient } from '@/lib/google';
import { SHEET_MAPPING, SHEET_NAMES } from '@/config/sheetMapping';

const toNumber = (value: unknown) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(String(value).replace(/[$,]/g, '').trim());
    return Number.isFinite(parsed) ? parsed : null;
};

const parseRows = (rows?: any[][] | null, labelIndex = 0, valueIndex = 1) => {
    if (!Array.isArray(rows)) return [];
    return rows
        .map((row) => ({
            label: String(row?.[labelIndex] ?? '').trim(),
            value: row?.[valueIndex],
        }))
        .filter((row) => row.label);
};

const buildItems = (rows?: any[][] | null) =>
    parseRows(rows).map((row) => ({
        id: `${row.label}-${Math.random().toString(16).slice(2)}`,
        name: row.label,
        amount: toNumber(row.value) ?? 0,
    }));

const buildGroupedItems = (rows?: any[][] | null) =>
    parseRows(rows).map((row) => ({
        category: row.label,
        total: toNumber(row.value) ?? 0,
    }));

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
            .select('spreadsheet_id')
            .eq('id', projectId)
            .single();

        if (error || !project?.spreadsheet_id) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const sheets = await getSheetsClient();
        const spreadsheetId = project.spreadsheet_id;

        const inputKeys = Object.keys(SHEET_MAPPING.inputs).filter(k => k !== 'sheetName');
        const inputRanges = inputKeys.map((key) => {
            const cell = SHEET_MAPPING.inputs[key as keyof typeof SHEET_MAPPING.inputs];
            return `'${SHEET_MAPPING.inputs.sheetName}'!${cell}`;
        });

        const pnlRanges = [
            `'${SHEET_NAMES.CATEGORIZATION}'!B4:C1000`,
            `'${SHEET_NAMES.CATEGORIZATION}'!E4:F1000`,
            `'${SHEET_NAMES.CATEGORIZATION}'!H4:I1000`,
            `'${SHEET_NAMES.CATEGORIZATION}'!K4:L1000`,
        ];

        const [inputsResponse, pnlResponse] = await Promise.all([
            sheets.spreadsheets.values.batchGet({
                spreadsheetId,
                ranges: inputRanges,
            }),
            sheets.spreadsheets.values.batchGet({
                spreadsheetId,
                ranges: pnlRanges,
            }),
        ]);

        const inputs: Record<string, any> = {};
        inputsResponse.data.valueRanges?.forEach((range, index) => {
            const key = inputKeys[index];
            const value = range.values?.[0]?.[0];
            if (value !== undefined && value !== null && value !== '') {
                inputs[key] = value;
            }
        });

        const pnlRangesData = pnlResponse.data.valueRanges || [];
        const incomeItems = buildItems(pnlRangesData[0]?.values);
        const expenseItems = buildItems(pnlRangesData[1]?.values);
        const groupedIncome = buildGroupedItems(pnlRangesData[2]?.values);
        const groupedExpenses = buildGroupedItems(pnlRangesData[3]?.values);

        return NextResponse.json({
            inputs,
            pnl: {
                incomeItems,
                expenseItems,
                groupedIncome,
                groupedExpenses,
            },
        });
    } catch (error: any) {
        console.error('Sheet load failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

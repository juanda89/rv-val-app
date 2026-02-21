import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSheetsClient } from '@/lib/google';
import { SHEET_MAPPING, SHEET_NAMES } from '@/config/sheetMapping';

const toNumber = (value: unknown) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(String(value).replace(/[$,]/g, '').trim());
    return Number.isFinite(parsed) ? parsed : null;
};

const normalizeLabel = (value: string) =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

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

const buildLabelMap = (rows: any[] = []) => {
    const labels: Record<string, any> = {};
    rows.forEach((row) => {
        const rawLabel = String(row?.[0] ?? '').trim();
        if (!rawLabel) return;
        const normalized = rawLabel
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
        const value = row?.[1];
        const existing = labels[normalized];
        const hasNewValue = value !== undefined && value !== null && value !== '';
        const hasExistingValue = existing !== undefined && existing !== null && existing !== '';

        if (!hasExistingValue || hasNewValue) {
            labels[normalized] = value;
        }
    });
    return labels;
};

const getRowFromCell = (cell: string) => {
    const match = cell.match(/\d+$/);
    return match ? Number(match[0]) : 0;
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
        const inputDefaultRanges = inputKeys.map((key) => {
            const cell = SHEET_MAPPING.inputs[key as keyof typeof SHEET_MAPPING.inputs];
            const row = getRowFromCell(cell);
            return `'${SHEET_MAPPING.inputs.sheetName}'!D${row}`;
        });
        const inputLabelRange = `'${SHEET_MAPPING.inputs.sheetName}'!B2:D500`;

        const outputKeys = Object.keys(SHEET_MAPPING.outputs).filter(k => k !== 'sheetName');
        const outputRanges = outputKeys.map((key) => {
            const cell = SHEET_MAPPING.outputs[key as keyof typeof SHEET_MAPPING.outputs];
            return `'${SHEET_MAPPING.outputs.sheetName}'!${cell}`;
        });
        const outputLabelRange = `'${SHEET_MAPPING.outputs.sheetName}'!B2:C2000`;

        const pnlRanges = [
            `'${SHEET_NAMES.CATEGORIZATION}'!B4:C1000`,
            `'${SHEET_NAMES.CATEGORIZATION}'!E4:F1000`,
            `'${SHEET_NAMES.CATEGORIZATION}'!H4:I1000`,
            `'${SHEET_NAMES.CATEGORIZATION}'!K4:L1000`,
        ];

        const [inputsResponse, outputResponse, pnlResponse] = await Promise.all([
            sheets.spreadsheets.values.batchGet({
                spreadsheetId,
                ranges: [...inputRanges, ...inputDefaultRanges, inputLabelRange],
            }),
            sheets.spreadsheets.values.batchGet({
                spreadsheetId,
                ranges: [...outputRanges, outputLabelRange],
            }),
            sheets.spreadsheets.values.batchGet({
                spreadsheetId,
                ranges: pnlRanges,
            }),
        ]);

        const inputs: Record<string, any> = {};
        const inputRangesData = inputsResponse.data.valueRanges || [];
        inputRangesData.slice(0, inputKeys.length).forEach((range, index) => {
            const key = inputKeys[index];
            const value = range.values?.[0]?.[0];
            if (value !== undefined && value !== null && value !== '') {
                inputs[key] = value;
            }
        });

        const defaultValues: Record<string, any> = {};
        inputRangesData.slice(inputKeys.length, inputKeys.length * 2).forEach((range, index) => {
            const key = inputKeys[index];
            const value = range.values?.[0]?.[0];
            if (value !== undefined && value !== null && value !== '') {
                defaultValues[key] = value;
            }
        });

        const inputLabelRows = inputRangesData[inputKeys.length * 2]?.values || [];
        inputLabelRows.forEach((row: any[]) => {
            const rawLabel = String(row?.[0] ?? '').trim();
            if (!rawLabel) return;
            const normalizedKey = normalizeLabel(rawLabel);
            const currentValue = row?.[1];
            const defaultValue = row?.[2];
            if (
                currentValue !== undefined &&
                currentValue !== null &&
                currentValue !== '' &&
                inputs[normalizedKey] === undefined
            ) {
                inputs[normalizedKey] = currentValue;
            }
            if (
                defaultValue !== undefined &&
                defaultValue !== null &&
                defaultValue !== '' &&
                defaultValues[normalizedKey] === undefined
            ) {
                defaultValues[normalizedKey] = defaultValue;
            }
        });

        if (Object.keys(defaultValues).length > 0) {
            inputs.default_values = defaultValues;
        }

        const pnlRangesData = pnlResponse.data.valueRanges || [];
        const incomeItems = buildItems(pnlRangesData[0]?.values);
        const expenseItems = buildItems(pnlRangesData[1]?.values);
        const groupedIncome = buildGroupedItems(pnlRangesData[2]?.values);
        const groupedExpenses = buildGroupedItems(pnlRangesData[3]?.values);

        const outputRangesData = outputResponse.data.valueRanges || [];
        const labelRows = outputRangesData[outputKeys.length]?.values || [];
        const labelMap = buildLabelMap(labelRows);
        const outputs: Record<string, any> = { ...labelMap };

        outputRangesData.slice(0, outputKeys.length).forEach((range, index) => {
            const key = outputKeys[index];
            const value = range.values?.[0]?.[0];
            if (value !== undefined && value !== null && value !== '' && outputs[key] === undefined) {
                outputs[key] = value;
            }
        });

        outputs.__labels = labelMap;

        return NextResponse.json({
            inputs,
            outputs,
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

import { getSheetsClient } from '@/lib/google';
import { SHEET_MAPPING, SHEET_NAMES } from '@/config/sheetMapping';
import { Dashboard } from '@/components/dashboard/Dashboard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = {
    params: {
        spreadsheetId?: string;
    };
};

const buildValueMap = (keys: string[], ranges: any[]) => {
    const data: Record<string, any> = {};
    ranges.forEach((range, index) => {
        const key = keys[index];
        const val = range?.values?.[0]?.[0];
        if (val !== undefined) data[key] = val;
    });
    return data;
};

const parseNameValueRows = (rows: any[] = []) =>
    rows
        .filter(row => row?.[0])
        .map((row, index) => ({
            id: `${index}-${row[0]}`,
            name: row[0],
            amount: Number(row[1]) || 0
        }));

const parseCategoryRows = (rows: any[] = []) =>
    rows
        .filter(row => row?.[0])
        .map((row) => ({
            category: row[0],
            total: Number(row[1]) || 0
        }));

export default async function ShareReportPage({ params }: Params) {
    if (!params?.spreadsheetId) {
        return (
            <div className="min-h-screen bg-[#111618] text-white flex items-center justify-center">
                <div className="text-center space-y-3">
                    <h1 className="text-2xl font-bold">Report link missing</h1>
                    <p className="text-sm text-gray-400">Please use a valid share link to access the valuation report.</p>
                </div>
            </div>
        );
    }

    const sheets = await getSheetsClient();
    const spreadsheetId = params.spreadsheetId;

    const inputKeys = Object.keys(SHEET_MAPPING.inputs).filter(key => key !== 'sheetName');
    const outputKeys = Object.keys(SHEET_MAPPING.outputs).filter(key => key !== 'sheetName');
    const inputRanges = inputKeys.map(key => `'${SHEET_NAMES.INPUT}'!${SHEET_MAPPING.inputs[key as keyof typeof SHEET_MAPPING.inputs]}`);
    const outputRanges = outputKeys.map(key => `'${SHEET_NAMES.OUTPUT}'!${SHEET_MAPPING.outputs[key as keyof typeof SHEET_MAPPING.outputs]}`);

    const { data: inputData } = await sheets.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges: inputRanges,
    });

    const { data: outputData } = await sheets.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges: outputRanges,
    });

    const { data: pnlData } = await sheets.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges: [
            `'${SHEET_NAMES.CATEGORIZATION}'!B4:C1000`,
            `'${SHEET_NAMES.CATEGORIZATION}'!E4:F1000`,
            `'${SHEET_NAMES.CATEGORIZATION}'!H4:I1000`,
            `'${SHEET_NAMES.CATEGORIZATION}'!K4:L1000`,
        ],
    });

    const inputs = buildValueMap(inputKeys, inputData.valueRanges || []);
    const outputs = buildValueMap(outputKeys, outputData.valueRanges || []);
    const ranges = pnlData.valueRanges || [];
    const incomeRows = ranges[0]?.values || [];
    const expenseRows = ranges[1]?.values || [];
    const groupedIncomeRows = ranges[2]?.values || [];
    const groupedExpenseRows = ranges[3]?.values || [];

    inputs.pnl_income_items = parseNameValueRows(incomeRows);
    inputs.pnl_expense_items = parseNameValueRows(expenseRows);
    inputs.pnl_grouped_income = parseCategoryRows(groupedIncomeRows);
    inputs.pnl_grouped_expenses = parseCategoryRows(groupedExpenseRows);

    return (
        <div className="min-h-screen bg-[#111618] text-white">
            <div className="max-w-6xl mx-auto px-6 py-10">
                <Dashboard outputs={outputs} inputs={inputs} readOnly />
            </div>
        </div>
    );
}

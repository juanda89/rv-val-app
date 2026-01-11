import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSheetsClient } from '@/lib/google';
import { SHEET_NAMES } from '@/config/sheetMapping';

export const runtime = 'nodejs';

const GROUPING_MODEL = 'models/gemini-pro-latest';
const VALIDATION_MODEL = 'models/gemini-pro-latest';

const CATEGORIZATION_SHEET = SHEET_NAMES.CATEGORIZATION;

const INCOME_CATEGORIES = [
    { key: 'rental_income', label: 'Rental Income' },
    { key: 'rv_income', label: 'RV Income' },
    { key: 'storage', label: 'Storage' },
    { key: 'late_fees', label: 'Late Fees' },
    { key: 'utility_reimbursements', label: 'Utility Reimbursements' },
    { key: 'other_income', label: 'Other Income' },
];

const EXPENSE_CATEGORIES = [
    { key: 'payroll', label: 'Payroll' },
    { key: 'utilities', label: 'Utilities' },
    { key: 'rm', label: 'R&M' },
    { key: 'advertising', label: 'Advertising' },
    { key: 'ga', label: 'G&A' },
    { key: 'insurance', label: 'Insurance' },
    { key: 're_taxes', label: 'RE Taxes' },
    { key: 'mgmt_fee', label: 'Mgmt. Fee' },
    { key: 'reserves', label: 'Reserves' },
];

const toNumber = (value: any) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const sumItems = (items: { amount: number }[]) =>
    items.reduce((sum, item) => sum + toNumber(item.amount), 0);

const buildGroupingPrompt = (
    incomeItems: { name: string; amount: number }[],
    expenseItems: { name: string; amount: number }[],
    extraInstructions?: string
) => `
You are an expert RV park valuation analyst.
Group the following income and expense line items into the exact categories listed.
Return ONLY valid JSON (no markdown, no extra text).
Use numbers for totals. Do not omit categories; use 0 if missing.

Income categories:
${INCOME_CATEGORIES.map(cat => `- ${cat.key}`).join('\n')}

Expense categories:
${EXPENSE_CATEGORIES.map(cat => `- ${cat.key}`).join('\n')}

Income items:
${incomeItems.map(item => `- ${item.name}: ${item.amount}`).join('\n')}

Expense items:
${expenseItems.map(item => `- ${item.name}: ${item.amount}`).join('\n')}

Return JSON like:
{
  "income": { "rental_income": 0, "rv_income": 0, "storage": 0, "late_fees": 0, "utility_reimbursements": 0, "other_income": 0 },
  "expenses": { "payroll": 0, "utilities": 0, "rm": 0, "advertising": 0, "ga": 0, "insurance": 0, "re_taxes": 0, "mgmt_fee": 0, "reserves": 0 }
}

${extraInstructions ? `Additional correction instructions:\n${extraInstructions}` : ''}
`;

const buildValidationPrompt = (
    originalIncome: number,
    originalExpenses: number,
    groupedIncome: number,
    groupedExpenses: number,
    incomeItems: { name: string; amount: number }[],
    expenseItems: { name: string; amount: number }[],
    groupedIncomeMap: Record<string, number>,
    groupedExpenseMap: Record<string, number>
) => `
You are validating grouped P&L totals.
Return ONLY valid JSON.

Original totals:
- income: ${originalIncome}
- expenses: ${originalExpenses}

Grouped totals:
- income: ${groupedIncome}
- expenses: ${groupedExpenses}

Original income items:
${incomeItems.map(item => `- ${item.name}: ${item.amount}`).join('\n')}

Original expense items:
${expenseItems.map(item => `- ${item.name}: ${item.amount}`).join('\n')}

Grouped income by category:
${Object.entries(groupedIncomeMap).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

Grouped expenses by category:
${Object.entries(groupedExpenseMap).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

If totals match within 0.01, respond:
{ "valid": true }

If not, respond:
{ "valid": false, "reason": "...", "correction_instructions": "..." }
`;

const callGemini = async (model: string, apiKey: string, prompt: string) => {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.1,
                    response_mime_type: 'application/json'
                }
            })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini request failed: ${errorText}`);
    }

    const json = await response.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text || typeof text !== 'string') {
        throw new Error('Gemini returned no content');
    }

    return JSON.parse(text);
};

export async function POST(req: Request) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Missing GEMINI_API_KEY' }, { status: 500 });
        }

        const { projectId, incomeItems, expenseItems } = await req.json();
        if (!projectId) {
            return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
        }

        const incomeList = Array.isArray(incomeItems) ? incomeItems : [];
        const expenseList = Array.isArray(expenseItems) ? expenseItems : [];

        const originalIncomeTotal = sumItems(incomeList);
        const originalExpenseTotal = sumItems(expenseList);

        let groupedIncomeMap: Record<string, number> = {};
        let groupedExpenseMap: Record<string, number> = {};
        let correctionInstructions = '';

        for (let attempt = 0; attempt < 3; attempt += 1) {
            const groupingPrompt = buildGroupingPrompt(
                incomeList,
                expenseList,
                correctionInstructions
            );
            const grouped = await callGemini(GROUPING_MODEL, apiKey, groupingPrompt);

            groupedIncomeMap = {};
            groupedExpenseMap = {};

            INCOME_CATEGORIES.forEach((cat) => {
                groupedIncomeMap[cat.key] = toNumber(grouped?.income?.[cat.key]);
            });
            EXPENSE_CATEGORIES.forEach((cat) => {
                groupedExpenseMap[cat.key] = toNumber(grouped?.expenses?.[cat.key]);
            });

            const groupedIncomeTotal = Object.values(groupedIncomeMap).reduce((sum, val) => sum + val, 0);
            const groupedExpenseTotal = Object.values(groupedExpenseMap).reduce((sum, val) => sum + val, 0);

            const validationPrompt = buildValidationPrompt(
                originalIncomeTotal,
                originalExpenseTotal,
                groupedIncomeTotal,
                groupedExpenseTotal,
                incomeList,
                expenseList,
                groupedIncomeMap,
                groupedExpenseMap
            );

            const validation = await callGemini(VALIDATION_MODEL, apiKey, validationPrompt);
            const isValid = validation?.valid === true;

            if (isValid) {
                break;
            }

            correctionInstructions =
                validation?.correction_instructions ||
                `Totals mismatch. Ensure grouped income equals ${originalIncomeTotal} and grouped expenses equals ${originalExpenseTotal}.`;
        }

        const groupedIncomeTotal = Object.values(groupedIncomeMap).reduce((sum, val) => sum + val, 0);
        const groupedExpenseTotal = Object.values(groupedExpenseMap).reduce((sum, val) => sum + val, 0);
        const totalsMatch =
            Math.abs(groupedIncomeTotal - originalIncomeTotal) <= 0.01 &&
            Math.abs(groupedExpenseTotal - originalExpenseTotal) <= 0.01;

        if (!totalsMatch) {
            return NextResponse.json(
                { error: 'Grouped totals do not match originals' },
                { status: 500 }
            );
        }

        const groupedIncome = INCOME_CATEGORIES.map(cat => ({
            category: cat.label,
            total: groupedIncomeMap[cat.key] ?? 0
        }));
        const groupedExpenses = EXPENSE_CATEGORIES.map(cat => ({
            category: cat.label,
            total: groupedExpenseMap[cat.key] ?? 0
        }));

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

        if (error || !project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const sheets = await getSheetsClient();
        const spreadsheetId = project.spreadsheet_id;

        await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: `'${CATEGORIZATION_SHEET}'!H4:I1000`,
        });
        await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: `'${CATEGORIZATION_SHEET}'!K4:L1000`,
        });

        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: {
                data: [
                    {
                        range: `'${CATEGORIZATION_SHEET}'!H4:I${groupedIncome.length + 3}`,
                        values: groupedIncome.map(item => [item.category, item.total]),
                    },
                    {
                        range: `'${CATEGORIZATION_SHEET}'!K4:L${groupedExpenses.length + 3}`,
                        values: groupedExpenses.map(item => [item.category, item.total]),
                    }
                ],
                valueInputOption: 'USER_ENTERED',
            }
        });

        return NextResponse.json({
            groupedIncome,
            groupedExpenses
        });
    } catch (error: any) {
        console.error('P&L grouping failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSheetsClient } from '@/lib/google';
import { SHEET_NAMES } from '@/config/sheetMapping';

const CATEGORIZATION_SHEET = SHEET_NAMES.CATEGORIZATION;

const buildRows = (items: { name: string; amount: number }[]) =>
    items.map((item) => [item.name, item.amount]);

export async function POST(req: Request) {
    try {
        const { projectId, incomeItems, expenseItems } = await req.json();
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

        if (error || !project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const sheets = await getSheetsClient();
        const spreadsheetId = project.spreadsheet_id;

        const incomeRows = buildRows(Array.isArray(incomeItems) ? incomeItems : []);
        const expenseRows = buildRows(Array.isArray(expenseItems) ? expenseItems : []);

        await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: `'${CATEGORIZATION_SHEET}'!B4:C1000`,
        });
        await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: `'${CATEGORIZATION_SHEET}'!E4:F1000`,
        });

        const updates = [];
        if (incomeRows.length > 0) {
            updates.push({
                range: `'${CATEGORIZATION_SHEET}'!B4:C${incomeRows.length + 3}`,
                values: incomeRows,
            });
        }
        if (expenseRows.length > 0) {
            updates.push({
                range: `'${CATEGORIZATION_SHEET}'!E4:F${expenseRows.length + 3}`,
                values: expenseRows,
            });
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

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('P&L sync failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

"use client";

import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Button } from "@/components/ui/Button";
import { SHEET_MAPPING } from "@/config/sheetMapping";

interface Step3Props {
    onDataChange: (data: any) => void;
    initialData?: any;
}

// Extract categories from config
const REVENUE_CATEGORIES = Object.keys(SHEET_MAPPING.inputs)
    .filter(k => k.startsWith('revenue_'))
    .map(k => ({ value: k, label: k.replace('revenue_', '').replace(/_/g, ' ').toUpperCase() }));

const EXPENSE_CATEGORIES = Object.keys(SHEET_MAPPING.inputs)
    .filter(k => k.startsWith('expense_'))
    .map(k => ({ value: k, label: k.replace('expense_', '').replace(/_/g, ' ').toUpperCase() }));

export const Step3PnL: React.FC<Step3Props> = ({ onDataChange }) => {
    const [rows, setRows] = useState<any[]>([]);
    const [mappings, setMappings] = useState<Record<number, string>>({});
    const [originalTotals, setOriginalTotals] = useState({ revenue: 0, expenses: 0 });
    const [fileError, setFileError] = useState<string | null>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

                // Basic parsing logic: assume Row 1 is headers, look for "Amount" and "Description"
                // This is a simplified parser. In reality, we might need heuristics.
                // For MVP, assume 2 columns: Description, Amount

                const parsedRows = data.slice(1).map((row, idx) => ({
                    id: idx,
                    description: row[0],
                    amount: parseFloat(row[1]) || 0
                })).filter(r => r.description && !isNaN(r.amount));

                // Auto-calculate originals (Naive approach: sum distinct positive/negative? 
                // Or ask user to verify. The roadmap says: "Calculate Original Total Revenue ... from raw file"
                // Let's sum positives as Rev, negatives as Exp? Or just sum all.
                // Actually, usually P&L has headers. 
                // For now, I'll calculate total absolute sum as a sanity check, 
                // but better: Let the user TELL us the totals or try to detect totals rows.
                // Simplified: Sum of all positive = Rev, Sum of negative (or specified exp) = Exp.
                // Let's just track the Sum of Mapped items vs Total of File.

                const total = parsedRows.reduce((acc, r) => acc + r.amount, 0);

                setRows(parsedRows);
                setOriginalTotals({ revenue: 0, expenses: 0 }); // Reset, we'll ask user or infer? 
                // Roadmap: "Calculate Original Total Revenue... from raw file". 
                // I will sum all rows for now as a starting point.

            } catch (err) {
                console.error(err);
                setFileError("Failed to parse file");
            }
        };
        reader.readAsBinaryString(file);
    };

    const totals = useMemo(() => {
        let rev = 0;
        let exp = 0;
        Object.entries(mappings).forEach(([rowId, cat]) => {
            const row = rows.find(r => r.id === Number(rowId));
            if (!row) return;
            if (cat.startsWith('revenue_')) rev += row.amount;
            if (cat.startsWith('expense_')) exp += row.amount;
        });
        return { revenue: rev, expenses: exp };
    }, [rows, mappings]);

    const isValid = Math.abs(totals.revenue - originalTotals.revenue) < 0.01 &&
        Math.abs(totals.expenses - originalTotals.expenses) < 0.01;

    // Manual override for expected totals if detection fails
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3">
                <h2 className="text-xl font-bold text-white">P&L Upload & Validation</h2>
                <p className="text-sm text-gray-400">Upload your P&L (CSV/Excel) and map categories.</p>
            </div>

            <div className="p-6 border-2 border-dashed border-gray-600 rounded-lg text-center hover:border-blue-500 transition-colors">
                <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} className="hidden" id="pnl-upload" />
                <label htmlFor="pnl-upload" className="cursor-pointer flex flex-col items-center gap-2">
                    <span className="material-symbols-outlined text-4xl text-gray-400">upload_file</span>
                    <span className="text-blue-400 font-medium">Click to upload P&L</span>
                    <span className="text-xs text-gray-500">Supported: .xlsx, .csv</span>
                </label>
            </div>

            {rows.length > 0 && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4 bg-[#1a2228] p-4 rounded-lg">
                        <div>
                            <label className="text-xs text-gray-400">Target Revenue (Original)</label>
                            <input
                                type="number"
                                className="w-full bg-transparent text-white border-b border-gray-600 focus:border-blue-500 outline-none"
                                value={originalTotals.revenue}
                                onChange={e => setOriginalTotals(p => ({ ...p, revenue: parseFloat(e.target.value) || 0 }))}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400">Target Expenses (Original)</label>
                            <input
                                type="number"
                                className="w-full bg-transparent text-white border-b border-gray-600 focus:border-blue-500 outline-none"
                                value={originalTotals.expenses}
                                onChange={e => setOriginalTotals(p => ({ ...p, expenses: parseFloat(e.target.value) || 0 }))}
                            />
                        </div>
                    </div>

                    <div className="max-h-96 overflow-auto border border-[#283339] rounded-lg">
                        <table className="w-full text-sm text-left text-gray-400">
                            <thead className="text-xs text-gray-200 uppercase bg-[#1a2228] sticky top-0">
                                <tr>
                                    <th className="px-6 py-3">Description</th>
                                    <th className="px-6 py-3">Amount</th>
                                    <th className="px-6 py-3">Category Map</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.id} className="border-b border-[#283339] hover:bg-[#283339]/50">
                                        <td className="px-6 py-4 font-medium text-white">{row.description}</td>
                                        <td className="px-6 py-4">${row.amount.toLocaleString()}</td>
                                        <td className="px-6 py-4">
                                            <select
                                                className="bg-transparent border border-gray-600 rounded px-2 py-1 text-white focus:border-blue-500"
                                                value={mappings[row.id] || ""}
                                                onChange={(e) => setMappings(p => ({ ...p, [row.id]: e.target.value }))}
                                            >
                                                <option value="">Ingore / Unmapped</option>
                                                <optgroup label="Revenue">
                                                    {REVENUE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                                </optgroup>
                                                <optgroup label="Expenses">
                                                    {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                                </optgroup>
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Validation Status */}
                    <div className={`p-4 rounded-lg flex items-center justify-between ${isValid ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                        <div>
                            <h4 className={`font-bold ${isValid ? 'text-green-500' : 'text-red-500'}`}>
                                {isValid ? "Validation Successful" : "Validation Failed"}
                            </h4>
                            <p className="text-xs text-gray-400">
                                Mapped Rev: ${totals.revenue.toLocaleString()} / Exp: ${totals.expenses.toLocaleString()}
                            </p>
                        </div>
                        <Button
                            disabled={!isValid}
                            onClick={() => {
                                // Calculate final categorized sums
                                const result: any = {};
                                Object.entries(mappings).forEach(([rowId, cat]) => {
                                    const amt = rows.find(r => r.id === Number(rowId))?.amount || 0;
                                    result[cat] = (result[cat] || 0) + amt;
                                });
                                onDataChange(result);
                            }}
                        >
                            Confirm & Sync
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

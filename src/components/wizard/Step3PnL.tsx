"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from "@/components/ui/Button";
import { supabase } from '@/lib/supabaseClient';

interface PnlItem {
    id: string;
    name: string;
    amount: number;
}

interface GroupedItem {
    category: string;
    total: number;
}

interface Step3Props {
    onDataChange: (data: any) => void;
    initialData?: any;
    projectId?: string | null;
}

const createId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const toNumber = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeItems = (items: any[]): PnlItem[] => {
    if (!Array.isArray(items)) return [];
    return items
        .map((item) => ({
            id: item.id || createId(),
            name: String(item.name || '').trim(),
            amount: Number(item.amount) || 0
        }))
        .filter((item) => item.name);
};

const itemsSignature = (items: PnlItem[]) =>
    JSON.stringify(items.map(item => ({ name: item.name, amount: item.amount })));

export const Step3PnL: React.FC<Step3Props> = ({ onDataChange, initialData, projectId }) => {
    const [incomeItems, setIncomeItems] = useState<PnlItem[]>(() =>
        normalizeItems(initialData?.pnl_income_items || initialData?.income_items || [])
    );
    const [expenseItems, setExpenseItems] = useState<PnlItem[]>(() =>
        normalizeItems(initialData?.pnl_expense_items || initialData?.expense_items || [])
    );
    const [groupedIncome, setGroupedIncome] = useState<GroupedItem[]>(() =>
        Array.isArray(initialData?.pnl_grouped_income) ? initialData.pnl_grouped_income : []
    );
    const [groupedExpenses, setGroupedExpenses] = useState<GroupedItem[]>(() =>
        Array.isArray(initialData?.pnl_grouped_expenses) ? initialData.pnl_grouped_expenses : []
    );

    const [incomeName, setIncomeName] = useState('');
    const [incomeAmount, setIncomeAmount] = useState('');
    const [expenseName, setExpenseName] = useState('');
    const [expenseAmount, setExpenseAmount] = useState('');
    const [groupingStatus, setGroupingStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [groupingMessage, setGroupingMessage] = useState('');
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
    const [syncMessage, setSyncMessage] = useState('');

    useEffect(() => {
        const nextIncome = normalizeItems(initialData?.pnl_income_items || initialData?.income_items || []);
        const nextExpenses = normalizeItems(initialData?.pnl_expense_items || initialData?.expense_items || []);
        const nextGroupedIncome = Array.isArray(initialData?.pnl_grouped_income) ? initialData.pnl_grouped_income : [];
        const nextGroupedExpenses = Array.isArray(initialData?.pnl_grouped_expenses) ? initialData.pnl_grouped_expenses : [];

        setIncomeItems((prev) => (
            itemsSignature(nextIncome) !== itemsSignature(prev) ? nextIncome : prev
        ));
        setExpenseItems((prev) => (
            itemsSignature(nextExpenses) !== itemsSignature(prev) ? nextExpenses : prev
        ));
        setGroupedIncome((prev) => (
            JSON.stringify(nextGroupedIncome) !== JSON.stringify(prev) ? nextGroupedIncome : prev
        ));
        setGroupedExpenses((prev) => (
            JSON.stringify(nextGroupedExpenses) !== JSON.stringify(prev) ? nextGroupedExpenses : prev
        ));
    }, [
        initialData?.pnl_income_items,
        initialData?.income_items,
        initialData?.pnl_expense_items,
        initialData?.expense_items,
        initialData?.pnl_grouped_income,
        initialData?.pnl_grouped_expenses
    ]);

    useEffect(() => {
        onDataChange({
            pnl_income_items: incomeItems,
            pnl_expense_items: expenseItems,
            pnl_grouped_income: groupedIncome,
            pnl_grouped_expenses: groupedExpenses
        });
    }, [incomeItems, expenseItems, groupedIncome, groupedExpenses, onDataChange]);

    useEffect(() => {
        if (!projectId) return;
        setSyncStatus('syncing');
        setSyncMessage('');
        const timeout = setTimeout(async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;

                const response = await fetch('/api/pnl/sync', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : ''
                    },
                    body: JSON.stringify({
                        projectId,
                        incomeItems,
                        expenseItems
                    })
                });

                const payload = await response.json();
                if (!response.ok) {
                    throw new Error(payload.error || 'Failed to sync originals');
                }
                setSyncStatus('idle');
            } catch (error: any) {
                setSyncStatus('error');
                setSyncMessage(error.message || 'Failed to sync originals');
            }
        }, 400);

        return () => clearTimeout(timeout);
    }, [projectId, incomeItems, expenseItems]);

    const totals = useMemo(() => ({
        income: incomeItems.reduce((sum, item) => sum + item.amount, 0),
        expenses: expenseItems.reduce((sum, item) => sum + item.amount, 0),
    }), [incomeItems, expenseItems]);

    const groupedTotals = useMemo(() => ({
        income: groupedIncome.reduce((sum, item) => sum + Number(item.total || 0), 0),
        expenses: groupedExpenses.reduce((sum, item) => sum + Number(item.total || 0), 0),
    }), [groupedIncome, groupedExpenses]);

    const totalsMatch = useMemo(() => {
        const within = (a: number, b: number) => Math.abs(a - b) < 0.01;
        return {
            income: within(totals.income, groupedTotals.income),
            expenses: within(totals.expenses, groupedTotals.expenses),
        };
    }, [totals.income, totals.expenses, groupedTotals.income, groupedTotals.expenses]);

    const handleAddIncome = () => {
        const name = incomeName.trim();
        if (!name) return;
        const amount = toNumber(incomeAmount);
        setIncomeItems(prev => [...prev, { id: createId(), name, amount }]);
        setIncomeName('');
        setIncomeAmount('');
    };

    const handleAddExpense = () => {
        const name = expenseName.trim();
        if (!name) return;
        const amount = toNumber(expenseAmount);
        setExpenseItems(prev => [...prev, { id: createId(), name, amount }]);
        setExpenseName('');
        setExpenseAmount('');
    };

    const handleRemoveIncome = (id: string) => {
        setIncomeItems(prev => prev.filter(item => item.id !== id));
    };

    const handleRemoveExpense = (id: string) => {
        setExpenseItems(prev => prev.filter(item => item.id !== id));
    };

    const handleGroupWithAi = async () => {
        if (!projectId) {
            setGroupingStatus('error');
            setGroupingMessage('Create a project before grouping.');
            return;
        }
        if (incomeItems.length === 0 && expenseItems.length === 0) {
            setGroupingStatus('error');
            setGroupingMessage('Add at least one income or expense item.');
            return;
        }

        setGroupingStatus('loading');
        setGroupingMessage('Analyzing and grouping P&L data...');

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const response = await fetch('/api/pnl/group', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({
                    projectId,
                    incomeItems,
                    expenseItems
                })
            });

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.error || 'Failed to group items');
            }

            setGroupedIncome(payload.groupedIncome || []);
            setGroupedExpenses(payload.groupedExpenses || []);
            setGroupingStatus('success');
            setGroupingMessage('Grouping complete. Categories have been updated.');
        } catch (error: any) {
            setGroupingStatus('error');
            setGroupingMessage(error.message || 'Grouping failed');
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-3">
                <h2 className="text-xl font-bold text-white">Income & Expenses</h2>
                <p className="text-sm text-gray-400">
                    Add income and expense line items manually, or review items imported from your document upload.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-white">Original Income</h3>
                    <div className="flex gap-2">
                        <input
                            value={incomeName}
                            onChange={(event) => setIncomeName(event.target.value)}
                            placeholder="Income name"
                            className="flex-1 rounded-md bg-[#283339] border border-transparent px-3 py-2 text-sm text-white"
                        />
                        <input
                            value={incomeAmount}
                            onChange={(event) => setIncomeAmount(event.target.value)}
                            placeholder="Amount"
                            type="number"
                            className="w-28 rounded-md bg-[#283339] border border-transparent px-3 py-2 text-sm text-white"
                        />
                        <Button onClick={handleAddIncome}>Add</Button>
                    </div>
                    <div className="space-y-2">
                        {incomeItems.length === 0 && (
                            <p className="text-xs text-gray-500">No income items yet.</p>
                        )}
                        {incomeItems.map(item => (
                            <div key={item.id} className="flex items-center justify-between rounded-lg bg-[#1a2228] px-3 py-2">
                                <div>
                                    <p className="text-sm text-white">{item.name}</p>
                                    <p className="text-xs text-gray-400">${item.amount.toLocaleString()}</p>
                                </div>
                                <button
                                    className="text-xs text-red-400 hover:text-red-300"
                                    onClick={() => handleRemoveIncome(item.id)}
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-white">Original Expenses</h3>
                    <div className="flex gap-2">
                        <input
                            value={expenseName}
                            onChange={(event) => setExpenseName(event.target.value)}
                            placeholder="Expense name"
                            className="flex-1 rounded-md bg-[#283339] border border-transparent px-3 py-2 text-sm text-white"
                        />
                        <input
                            value={expenseAmount}
                            onChange={(event) => setExpenseAmount(event.target.value)}
                            placeholder="Amount"
                            type="number"
                            className="w-28 rounded-md bg-[#283339] border border-transparent px-3 py-2 text-sm text-white"
                        />
                        <Button onClick={handleAddExpense}>Add</Button>
                    </div>
                    <div className="space-y-2">
                        {expenseItems.length === 0 && (
                            <p className="text-xs text-gray-500">No expense items yet.</p>
                        )}
                        {expenseItems.map(item => (
                            <div key={item.id} className="flex items-center justify-between rounded-lg bg-[#1a2228] px-3 py-2">
                                <div>
                                    <p className="text-sm text-white">{item.name}</p>
                                    <p className="text-xs text-gray-400">${item.amount.toLocaleString()}</p>
                                </div>
                                <button
                                    className="text-xs text-red-400 hover:text-red-300"
                                    onClick={() => handleRemoveExpense(item.id)}
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-[#283339] bg-[#141b21] p-4 flex items-center justify-between">
                <div>
                    <p className="text-xs text-gray-400">Original Totals</p>
                    <p className="text-sm text-white">Income: ${totals.income.toLocaleString()} · Expenses: ${totals.expenses.toLocaleString()}</p>
                </div>
                <Button
                    onClick={handleGroupWithAi}
                    disabled={groupingStatus === 'loading'}
                >
                    {groupingStatus === 'loading' ? 'Grouping...' : 'Group / Categorize with AI'}
                </Button>
            </div>

            {(groupedIncome.length > 0 || groupedExpenses.length > 0) && (
                <div className="rounded-xl border border-[#283339] bg-[#141b21] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-400">Income Totals</p>
                            <p className="text-sm text-white">
                                Original: ${totals.income.toLocaleString()} · Grouped: ${groupedTotals.income.toLocaleString()}
                            </p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${totalsMatch.income ? 'bg-emerald-500/15 text-emerald-300' : 'bg-yellow-500/15 text-yellow-200'}`}>
                            {totalsMatch.income ? 'Matched' : 'Mismatch'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-400">Expense Totals</p>
                            <p className="text-sm text-white">
                                Original: ${totals.expenses.toLocaleString()} · Grouped: ${groupedTotals.expenses.toLocaleString()}
                            </p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${totalsMatch.expenses ? 'bg-emerald-500/15 text-emerald-300' : 'bg-yellow-500/15 text-yellow-200'}`}>
                            {totalsMatch.expenses ? 'Matched' : 'Mismatch'}
                        </span>
                    </div>
                </div>
            )}

            {groupingStatus === 'error' && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
                    {groupingMessage}
                </div>
            )}

            {groupingStatus === 'success' && (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                    {groupingMessage}
                </div>
            )}

            {syncStatus === 'error' && (
                <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-200">
                    {syncMessage}
                </div>
            )}

            {(groupedIncome.length > 0 || groupedExpenses.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-white">Grouped Income</h3>
                        <div className="space-y-2">
                            {groupedIncome.map(item => (
                                <div key={item.category} className="flex items-center justify-between rounded-lg bg-[#1a2228] px-3 py-2">
                                    <span className="text-sm text-white">{item.category}</span>
                                    <span className="text-sm text-gray-300">${item.total.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-white">Grouped Expenses</h3>
                        <div className="space-y-2">
                            {groupedExpenses.map(item => (
                                <div key={item.category} className="flex items-center justify-between rounded-lg bg-[#1a2228] px-3 py-2">
                                    <span className="text-sm text-white">{item.category}</span>
                                    <span className="text-sm text-gray-300">${item.total.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

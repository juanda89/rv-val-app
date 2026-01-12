"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from "@/components/ui/Button";
import { supabase } from '@/lib/supabaseClient';
import { Trash2 } from 'lucide-react';

interface PnlItem {
    id: string;
    name: string;
    amount: number;
}

interface GroupedItem {
    category: string;
    total: number;
}

interface PnlAssignment {
    id: string;
    category: string;
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

const normalizeAssignments = (items: any[]): PnlAssignment[] => {
    if (!Array.isArray(items)) return [];
    return items
        .map((item) => ({
            id: String(item?.id || '').trim(),
            category: String(item?.category || '').trim(),
        }))
        .filter((item) => item.id && item.category);
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

const formatCurrency = (value: number) => `$${value.toLocaleString()}`;

const formatDelta = (value: number) => {
    const absValue = Math.abs(value);
    const sign = value >= 0 ? '+' : '-';
    return `${sign}$${absValue.toLocaleString()}`;
};

const CATEGORY_LABELS: Record<string, string> = {
    rental_income: 'Rental Income',
    rv_income: 'RV Income',
    storage: 'Storage',
    late_fees: 'Late Fees',
    utility_reimbursements: 'Utility Reimbursements',
    other_income: 'Other Income',
    payroll: 'Payroll',
    utilities: 'Utilities',
    rm: 'R&M',
    advertising: 'Advertising',
    ga: 'G&A',
    insurance: 'Insurance',
    re_taxes: 'RE Taxes',
    mgmt_fee: 'Mgmt. Fee',
    reserves: 'Reserves',
};

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
    const [incomeAssignments, setIncomeAssignments] = useState<PnlAssignment[]>(() =>
        normalizeAssignments(initialData?.pnl_income_assignments || [])
    );
    const [expenseAssignments, setExpenseAssignments] = useState<PnlAssignment[]>(() =>
        normalizeAssignments(initialData?.pnl_expense_assignments || [])
    );

    const [incomeName, setIncomeName] = useState('');
    const [incomeAmount, setIncomeAmount] = useState('');
    const [expenseName, setExpenseName] = useState('');
    const [expenseAmount, setExpenseAmount] = useState('');
    const [groupingStatus, setGroupingStatus] = useState<'idle' | 'loading' | 'success' | 'warning' | 'error'>('idle');
    const [groupingMessage, setGroupingMessage] = useState('');
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
    const [syncMessage, setSyncMessage] = useState('');
    const [groupedSyncStatus, setGroupedSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
    const [groupedSyncMessage, setGroupedSyncMessage] = useState('');
    const initialDataSignatureRef = useRef<string>('');
    const skipSyncRef = useRef(true);
    const skipGroupedSyncRef = useRef(true);

    useEffect(() => {
        const nextIncome = normalizeItems(initialData?.pnl_income_items || initialData?.income_items || []);
        const nextExpenses = normalizeItems(initialData?.pnl_expense_items || initialData?.expense_items || []);
        const nextGroupedIncome = Array.isArray(initialData?.pnl_grouped_income) ? initialData.pnl_grouped_income : [];
        const nextGroupedExpenses = Array.isArray(initialData?.pnl_grouped_expenses) ? initialData.pnl_grouped_expenses : [];
        const nextIncomeAssignments = normalizeAssignments(initialData?.pnl_income_assignments || []);
        const nextExpenseAssignments = normalizeAssignments(initialData?.pnl_expense_assignments || []);

        const signature = JSON.stringify({
            income: itemsSignature(nextIncome),
            expenses: itemsSignature(nextExpenses),
            groupedIncome: JSON.stringify(nextGroupedIncome),
            groupedExpenses: JSON.stringify(nextGroupedExpenses),
            incomeAssignments: JSON.stringify(nextIncomeAssignments),
            expenseAssignments: JSON.stringify(nextExpenseAssignments),
        });

        if (signature === initialDataSignatureRef.current) return;
        initialDataSignatureRef.current = signature;

        skipSyncRef.current = true;
        skipGroupedSyncRef.current = true;

        setIncomeItems(nextIncome);
        setExpenseItems(nextExpenses);
        setGroupedIncome(nextGroupedIncome);
        setGroupedExpenses(nextGroupedExpenses);
        setIncomeAssignments(nextIncomeAssignments);
        setExpenseAssignments(nextExpenseAssignments);
    }, [initialData]);

    useEffect(() => {
        onDataChange({
            pnl_income_items: incomeItems,
            pnl_expense_items: expenseItems,
            pnl_grouped_income: groupedIncome,
            pnl_grouped_expenses: groupedExpenses,
            pnl_income_assignments: incomeAssignments,
            pnl_expense_assignments: expenseAssignments
        });
    }, [incomeItems, expenseItems, groupedIncome, groupedExpenses, incomeAssignments, expenseAssignments, onDataChange]);

    useEffect(() => {
        if (!projectId) return;
        if (skipSyncRef.current) {
            skipSyncRef.current = false;
            return;
        }
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

    useEffect(() => {
        if (!projectId) return;
        if (skipGroupedSyncRef.current) {
            skipGroupedSyncRef.current = false;
            return;
        }
        if (groupedIncome.length === 0 && groupedExpenses.length === 0) return;
        setGroupedSyncStatus('syncing');
        setGroupedSyncMessage('');
        const timeout = setTimeout(async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;

                const response = await fetch('/api/pnl/grouped/sync', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : ''
                    },
                    body: JSON.stringify({
                        projectId,
                        groupedIncome,
                        groupedExpenses
                    })
                });

                const payload = await response.json();
                if (!response.ok) {
                    throw new Error(payload.error || 'Failed to sync grouped totals');
                }
                setGroupedSyncStatus('idle');
            } catch (error: any) {
                setGroupedSyncStatus('error');
                setGroupedSyncMessage(error.message || 'Failed to sync grouped totals');
            }
        }, 500);

        return () => clearTimeout(timeout);
    }, [projectId, groupedIncome, groupedExpenses]);

    const totals = useMemo(() => ({
        income: incomeItems.reduce((sum, item) => sum + item.amount, 0),
        expenses: expenseItems.reduce((sum, item) => sum + item.amount, 0),
    }), [incomeItems, expenseItems]);

    const groupedTotals = useMemo(() => ({
        income: groupedIncome.reduce((sum, item) => sum + Number(item.total || 0), 0),
        expenses: groupedExpenses.reduce((sum, item) => sum + Number(item.total || 0), 0),
    }), [groupedIncome, groupedExpenses]);

    const hasGrouped = groupedIncome.length > 0 || groupedExpenses.length > 0;

    const totalsMatch = useMemo(() => {
        const within = (a: number, b: number) => Math.abs(a - b) < 0.01;
        return {
            income: within(totals.income, groupedTotals.income),
            expenses: within(totals.expenses, groupedTotals.expenses),
        };
    }, [totals.income, totals.expenses, groupedTotals.income, groupedTotals.expenses]);

    const overallMatch = hasGrouped && totalsMatch.income && totalsMatch.expenses;

    const incomeDelta = groupedTotals.income - totals.income;
    const expenseDelta = groupedTotals.expenses - totals.expenses;

    const incomeAssignmentMap = useMemo(() => (
        new Map(incomeAssignments.map((item) => [item.id, item.category]))
    ), [incomeAssignments]);
    const expenseAssignmentMap = useMemo(() => (
        new Map(expenseAssignments.map((item) => [item.id, item.category]))
    ), [expenseAssignments]);

    const getCategoryLabel = (category?: string) => {
        if (!category) return '';
        return CATEGORY_LABELS[category] || category;
    };

    useEffect(() => {
        if (!hasGrouped || groupingStatus === 'loading' || groupingStatus === 'error') return;
        if (overallMatch && groupingStatus === 'warning') {
            setGroupingStatus('success');
            setGroupingMessage('Totals match. You can continue.');
        }
        if (!overallMatch && groupingStatus === 'success') {
            setGroupingStatus('warning');
            setGroupingMessage('Totals no longer match originals. Please regroup.');
        }
    }, [hasGrouped, overallMatch, groupingStatus]);

    const handleGroupedIncomeChange = (index: number, value: string) => {
        const nextValue = toNumber(value);
        setGroupedIncome((prev) => prev.map((item, idx) => (
            idx === index ? { ...item, total: nextValue } : item
        )));
    };

    const handleGroupedExpenseChange = (index: number, value: string) => {
        const nextValue = toNumber(value);
        setGroupedExpenses((prev) => prev.map((item, idx) => (
            idx === index ? { ...item, total: nextValue } : item
        )));
    };

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

            const nextGroupedIncome = payload.groupedIncome || [];
            const nextGroupedExpenses = payload.groupedExpenses || [];
            setGroupedIncome(nextGroupedIncome);
            setGroupedExpenses(nextGroupedExpenses);
            setIncomeAssignments(normalizeAssignments(payload.incomeAssignments || []));
            setExpenseAssignments(normalizeAssignments(payload.expenseAssignments || []));

            if (payload.totalsMatch) {
                setGroupingStatus('success');
                setGroupingMessage('Grouping complete. Totals match.');
            } else {
                setGroupingStatus('warning');
                setGroupingMessage(payload.message || 'Grouped totals do not match originals.');
            }
        } catch (error: any) {
            setGroupingStatus('error');
            setGroupingMessage(error.message || 'Grouping failed');
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-3">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Income & Expenses</h2>
                <p className="text-sm text-slate-500 dark:text-gray-400">
                    Add income and expense line items manually, or review items imported from your document upload.
                </p>
            </div>

            <div
                className={`rounded-xl border p-4 sticky top-20 z-10 transition-colors ${
                    hasGrouped
                        ? overallMatch
                            ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10'
                            : 'border-red-200 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10'
                        : 'border-slate-200 bg-white dark:border-[#283339] dark:bg-[#141b21]'
                }`}
            >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3 flex-1">
                        <div>
                            <p className="text-xs text-slate-500 dark:text-gray-400">Original vs Grouped Totals</p>
                            <p className="text-sm text-slate-900 dark:text-white">
                                Grouping is required to continue. Review the totals below.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="rounded-lg bg-white/80 dark:bg-[#1a2228] border border-slate-200/70 dark:border-white/10 px-3 py-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold text-slate-600 dark:text-gray-300">Income</p>
                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                        !hasGrouped
                                            ? 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-gray-300'
                                            : totalsMatch.income
                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200'
                                                : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200'
                                    }`}>
                                        {!hasGrouped ? 'Pending' : totalsMatch.income ? 'Matched' : 'Mismatch'}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-900 dark:text-white">
                                    Original: {formatCurrency(totals.income)} · Grouped: {hasGrouped ? formatCurrency(groupedTotals.income) : '--'}
                                </p>
                                <p className={`text-xs ${
                                    !hasGrouped
                                        ? 'text-slate-500 dark:text-gray-400'
                                        : totalsMatch.income
                                            ? 'text-emerald-600 dark:text-emerald-300'
                                            : 'text-red-600 dark:text-red-300'
                                }`}>
                                    Difference: {hasGrouped ? formatDelta(incomeDelta) : '--'}
                                </p>
                            </div>
                            <div className="rounded-lg bg-white/80 dark:bg-[#1a2228] border border-slate-200/70 dark:border-white/10 px-3 py-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold text-slate-600 dark:text-gray-300">Expenses</p>
                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                        !hasGrouped
                                            ? 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-gray-300'
                                            : totalsMatch.expenses
                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200'
                                                : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200'
                                    }`}>
                                        {!hasGrouped ? 'Pending' : totalsMatch.expenses ? 'Matched' : 'Mismatch'}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-900 dark:text-white">
                                    Original: {formatCurrency(totals.expenses)} · Grouped: {hasGrouped ? formatCurrency(groupedTotals.expenses) : '--'}
                                </p>
                                <p className={`text-xs ${
                                    !hasGrouped
                                        ? 'text-slate-500 dark:text-gray-400'
                                        : totalsMatch.expenses
                                            ? 'text-emerald-600 dark:text-emerald-300'
                                            : 'text-red-600 dark:text-red-300'
                                }`}>
                                    Difference: {hasGrouped ? formatDelta(expenseDelta) : '--'}
                                </p>
                            </div>
                        </div>
                        {groupingStatus === 'warning' && (
                            <p className="text-xs text-red-600 dark:text-red-300">{groupingMessage}</p>
                        )}
                        {groupingStatus === 'error' && (
                            <p className="text-xs text-red-600 dark:text-red-300">{groupingMessage}</p>
                        )}
                        {groupingStatus === 'success' && (
                            <p className="text-xs text-emerald-600 dark:text-emerald-300">{groupingMessage}</p>
                        )}
                        {syncStatus === 'error' && (
                            <p className="text-xs text-yellow-700 dark:text-yellow-200">{syncMessage}</p>
                        )}
                        {groupedSyncStatus === 'error' && (
                            <p className="text-xs text-yellow-700 dark:text-yellow-200">{groupedSyncMessage}</p>
                        )}
                    </div>
                    <div className="flex flex-col gap-2 lg:items-end">
                        <Button
                            onClick={handleGroupWithAi}
                            disabled={groupingStatus === 'loading'}
                        >
                            {groupingStatus === 'loading' ? 'Grouping...' : 'Group / Categorize with AI'}
                        </Button>
                        {groupingStatus === 'loading' && (
                            <span className="text-xs text-slate-500 dark:text-gray-400">Analyzing and grouping P&amp;L data...</span>
                        )}
                        {hasGrouped && !overallMatch && (
                            <span className="text-xs text-red-600 dark:text-red-300">Totals must match to continue.</span>
                        )}
                        {overallMatch && (
                            <span className="text-xs text-emerald-600 dark:text-emerald-300">Totals match. You can continue.</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Original Income</h3>
                    <div className="flex gap-2">
                        <input
                            value={incomeName}
                            onChange={(event) => setIncomeName(event.target.value)}
                            placeholder="Income name"
                            className="flex-1 rounded-md bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent px-3 py-2 text-sm text-slate-900 dark:text-white"
                        />
                        <input
                            value={incomeAmount}
                            onChange={(event) => setIncomeAmount(event.target.value)}
                            placeholder="Amount"
                            type="number"
                            className="w-28 rounded-md bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent px-3 py-2 text-sm text-slate-900 dark:text-white"
                        />
                        <Button onClick={handleAddIncome}>Add</Button>
                    </div>
                    <div className="space-y-2">
                        {incomeItems.length === 0 && (
                            <p className="text-xs text-slate-500 dark:text-gray-500">No income items yet.</p>
                        )}
                        {incomeItems.map(item => (
                            <div key={item.id} className="flex items-center justify-between rounded-lg bg-slate-100 dark:bg-[#1a2228] px-3 py-2">
                                <div>
                                    <p className="text-sm text-slate-900 dark:text-white">{item.name}</p>
                                    <p className="text-xs text-slate-500 dark:text-gray-400">{formatCurrency(item.amount)}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {hasGrouped && (
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                            incomeAssignmentMap.get(item.id)
                                                ? 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-gray-200'
                                                : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-gray-400'
                                        }`}>
                                            {incomeAssignmentMap.get(item.id)
                                                ? getCategoryLabel(incomeAssignmentMap.get(item.id))
                                                : 'Unassigned'}
                                        </span>
                                    )}
                                    <button
                                        className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                                        onClick={() => handleRemoveIncome(item.id)}
                                        aria-label="Remove income item"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Original Expenses</h3>
                    <div className="flex gap-2">
                        <input
                            value={expenseName}
                            onChange={(event) => setExpenseName(event.target.value)}
                            placeholder="Expense name"
                            className="flex-1 rounded-md bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent px-3 py-2 text-sm text-slate-900 dark:text-white"
                        />
                        <input
                            value={expenseAmount}
                            onChange={(event) => setExpenseAmount(event.target.value)}
                            placeholder="Amount"
                            type="number"
                            className="w-28 rounded-md bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent px-3 py-2 text-sm text-slate-900 dark:text-white"
                        />
                        <Button onClick={handleAddExpense}>Add</Button>
                    </div>
                    <div className="space-y-2">
                        {expenseItems.length === 0 && (
                            <p className="text-xs text-slate-500 dark:text-gray-500">No expense items yet.</p>
                        )}
                        {expenseItems.map(item => (
                            <div key={item.id} className="flex items-center justify-between rounded-lg bg-slate-100 dark:bg-[#1a2228] px-3 py-2">
                                <div>
                                    <p className="text-sm text-slate-900 dark:text-white">{item.name}</p>
                                    <p className="text-xs text-slate-500 dark:text-gray-400">{formatCurrency(item.amount)}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {hasGrouped && (
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                            expenseAssignmentMap.get(item.id)
                                                ? 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-gray-200'
                                                : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-gray-400'
                                        }`}>
                                            {expenseAssignmentMap.get(item.id)
                                                ? getCategoryLabel(expenseAssignmentMap.get(item.id))
                                                : 'Unassigned'}
                                        </span>
                                    )}
                                    <button
                                        className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                                        onClick={() => handleRemoveExpense(item.id)}
                                        aria-label="Remove expense item"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {hasGrouped && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Grouped Income (editable)</h3>
                        <div className="space-y-2">
                            {groupedIncome.map((item, index) => (
                                <div key={item.category} className="flex items-center justify-between rounded-lg bg-slate-100 dark:bg-[#1a2228] px-3 py-2">
                                    <span className="text-sm text-slate-900 dark:text-white">{item.category}</span>
                                    <input
                                        type="number"
                                        value={item.total}
                                        onChange={(event) => handleGroupedIncomeChange(index, event.target.value)}
                                        className="w-28 rounded-md bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent px-2 py-1 text-sm text-slate-900 dark:text-white text-right"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Grouped Expenses (editable)</h3>
                        <div className="space-y-2">
                            {groupedExpenses.map((item, index) => (
                                <div key={item.category} className="flex items-center justify-between rounded-lg bg-slate-100 dark:bg-[#1a2228] px-3 py-2">
                                    <span className="text-sm text-slate-900 dark:text-white">{item.category}</span>
                                    <input
                                        type="number"
                                        value={item.total}
                                        onChange={(event) => handleGroupedExpenseChange(index, event.target.value)}
                                        className="w-28 rounded-md bg-white dark:bg-[#283339] border border-slate-300 dark:border-transparent px-2 py-1 text-sm text-slate-900 dark:text-white text-right"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

"use client";

import React, { useMemo, useState } from 'react';

interface DashboardProps {
    outputs: any;
    inputs: any;
    onInputChange?: (data: any) => void;
    readOnly?: boolean;
    shareId?: string;
    onRefreshOutputs?: () => void;
    refreshingOutputs?: boolean;
}

type MetricItem = {
    label: string;
    displayLabel: string;
    value: number | null;
    format: 'currency' | 'percent' | 'number';
};

type SeriesPoint = {
    label: string;
    value: number;
    normalized: number;
};

type LineSeries = {
    label: string;
    values: number[];
    color: string;
    softColor: string;
};

type PnlItem = {
    id: string;
    name: string;
    amount: number;
};

type GroupedItem = {
    category: string;
    total: number;
};

type PnlAssignment = {
    id: string;
    category: string;
};

const normalizeLabel = (label: string) =>
    label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

const SummaryCard = ({
    icon,
    iconClass,
    label,
    value
}: {
    icon: string;
    iconClass: string;
    label: string;
    value: string;
}) => (
    <div className="flex items-center gap-4 rounded-xl p-4 bg-white dark:bg-[#232f48] border border-slate-200 dark:border-white/5 shadow-sm">
        <div className={`p-2 rounded-lg ${iconClass}`}>
            <span className="material-symbols-outlined">{icon}</span>
        </div>
        <div>
            <p className="text-slate-500 dark:text-[#92a4c9] text-sm font-medium">{label}</p>
            <p className="text-slate-900 dark:text-white text-2xl font-bold tracking-tight">{value}</p>
        </div>
    </div>
);

const MetricPanel = ({
    title,
    items,
    formatValue,
    highlightLabel
}: {
    title: string;
    items: MetricItem[];
    formatValue: (value: number | null, format: MetricItem['format']) => string;
    highlightLabel?: string;
}) => (
    <div className="rounded-xl bg-white dark:bg-[#232f48] border border-slate-200 dark:border-white/5 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">{title}</h3>
        <div className="space-y-3">
            {items.map((item) => (
                <div
                    key={item.label}
                    className={`flex items-center justify-between text-sm ${
                        highlightLabel === item.label ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-[#92a4c9]'
                    }`}
                >
                    <span>{item.displayLabel}</span>
                    <span className="text-slate-900 dark:text-white font-semibold">
                        {formatValue(item.value, item.format)}
                    </span>
                </div>
            ))}
        </div>
    </div>
);

const StackedBarChart = ({
    title,
    labels,
    series,
    caption
}: {
    title: string;
    labels: string[];
    series: LineSeries[];
    caption?: string;
}) => {
    const totals = labels.map((_, idx) =>
        series.reduce((sum, line) => sum + (line.values[idx] ?? 0), 0)
    );
    const maxTotal = Math.max(...totals, 1);

    return (
        <div className="rounded-xl bg-white dark:bg-[#232f48] border border-slate-200 dark:border-white/5 p-5 shadow-sm">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
                    {caption && (
                        <p className="text-[11px] text-slate-400 dark:text-[#92a4c9] mt-1">{caption}</p>
                    )}
                </div>
                <span className="text-[11px] text-slate-400 dark:text-[#92a4c9]">Year 0-5</span>
            </div>
            <div className="mt-5">
                <div className="flex items-end gap-4 h-48">
                    {labels.map((label, idx) => (
                        <div key={label} className="flex flex-1 flex-col items-center gap-2">
                            <div className="relative flex h-40 w-full max-w-[56px] flex-col justify-end rounded-lg bg-slate-100 dark:bg-[#1a2434] overflow-hidden border border-slate-200/60 dark:border-white/5">
                                {series.slice().reverse().map((line) => {
                                    const value = line.values[idx] ?? 0;
                                    const height = Math.max((value / maxTotal) * 100, 0);
                                    return (
                                        <div
                                            key={`${line.label}-${label}`}
                                            className="w-full"
                                            style={{ height: `${height}%`, backgroundColor: line.color }}
                                        />
                                    );
                                })}
                            </div>
                            <span className="text-[11px] text-slate-500 dark:text-[#92a4c9]">{label}</span>
                        </div>
                    ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500 dark:text-[#92a4c9]">
                    {series.map((line) => (
                        <div key={line.label} className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: line.color }}></span>
                            <span>{line.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const DualAxisLineChart = ({
    title,
    leftLabel,
    rightLabel,
    leftSeries,
    rightSeries,
    formatValue
}: {
    title: string;
    leftLabel: string;
    rightLabel: string;
    leftSeries: SeriesPoint[];
    rightSeries: SeriesPoint[];
    formatValue: (value: number | null, format: MetricItem['format']) => string;
}) => {
    const width = 320;
    const height = 140;
    const padding = 28;

    const buildPoints = (series: SeriesPoint[]) =>
        series
            .map((point, index) => {
                const x = padding + (index / Math.max(series.length - 1, 1)) * (width - padding * 2);
                const y = padding + (1 - point.normalized) * (height - padding * 2);
                return `${x},${y}`;
            })
            .join(' ');

    const leftPath = buildPoints(leftSeries);
    const rightPath = buildPoints(rightSeries);
    const buildArea = (series: SeriesPoint[]) => {
        if (series.length === 0) return '';
        const points = buildPoints(series);
        const firstX = padding;
        const lastX = padding + ((series.length - 1) / Math.max(series.length - 1, 1)) * (width - padding * 2);
        return `M ${points} L ${lastX},${height - padding} L ${firstX},${height - padding} Z`;
    };

    return (
        <div className="rounded-xl bg-white dark:bg-[#232f48] border border-slate-200 dark:border-white/5 p-5 shadow-sm">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
                <span className="text-[11px] text-slate-400 dark:text-[#92a4c9]">Year 1-5</span>
            </div>
            <div className="mt-4">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44">
                    <defs>
                        <linearGradient id="occupancyFill" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="roeFill" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    {Array.from({ length: 4 }).map((_, idx) => {
                        const y = padding + ((height - padding * 2) / 3) * idx;
                        return (
                            <line key={idx} x1={padding} y1={y} x2={width - padding} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                        );
                    })}
                    <path d={buildArea(leftSeries)} fill="url(#occupancyFill)" />
                    <path d={buildArea(rightSeries)} fill="url(#roeFill)" />
                    <polyline points={leftPath} fill="none" stroke="#0ea5e9" strokeWidth="2" />
                    <polyline points={rightPath} fill="none" stroke="#a855f7" strokeWidth="2" />
                    {leftSeries.map((point, index) => {
                        const x = padding + (index / Math.max(leftSeries.length - 1, 1)) * (width - padding * 2);
                        const y = padding + (1 - point.normalized) * (height - padding * 2);
                        return <circle key={`left-${point.label}`} cx={x} cy={y} r={3} fill="#0ea5e9" />;
                    })}
                    {rightSeries.map((point, index) => {
                        const x = padding + (index / Math.max(rightSeries.length - 1, 1)) * (width - padding * 2);
                        const y = padding + (1 - point.normalized) * (height - padding * 2);
                        return <circle key={`right-${point.label}`} cx={x} cy={y} r={3} fill="#a855f7" />;
                    })}
                    <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e2e8f0" strokeWidth="1" />
                    <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#e2e8f0" strokeWidth="1" />
                    <line x1={width - padding} y1={padding} x2={width - padding} y2={height - padding} stroke="#e2e8f0" strokeWidth="1" />
                </svg>
                <div className="flex justify-between text-xs text-slate-500 dark:text-[#92a4c9] px-2">
                    <span>{leftLabel}</span>
                    <span>{rightLabel}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-6 text-xs text-slate-500 dark:text-[#92a4c9]">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-sky-500"></span>
                        <span>{leftLabel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                        <span>{rightLabel}</span>
                    </div>
                </div>
                <div className="mt-4 text-xs text-slate-500 dark:text-[#92a4c9]">
                    <div className="grid grid-cols-3 gap-2 font-semibold text-slate-700 dark:text-white mb-2">
                        <span>Year</span>
                        <span>{leftLabel}</span>
                        <span>{rightLabel}</span>
                    </div>
                    {leftSeries.map((point, index) => {
                        const rightPoint = rightSeries[index];
                        return (
                            <div key={`line-values-${point.label}`} className="grid grid-cols-3 gap-2">
                                <span className="text-slate-500 dark:text-[#92a4c9]">{point.label}</span>
                                <span className="text-slate-900 dark:text-white font-semibold">
                                    {formatValue(point.value, 'percent')}
                                </span>
                                <span className="text-slate-900 dark:text-white font-semibold">
                                    {formatValue(rightPoint?.value ?? 0, 'percent')}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const PnlComparisonTable = ({
    title,
    lotCount,
    incomeRows,
    expenseRows,
    totals,
    formatCurrency,
}: {
    title: string;
    lotCount: number | null;
    incomeRows: { label: string; historical: number; grouped: number }[];
    expenseRows: { label: string; historical: number; grouped: number }[];
    totals: {
        incomeHistorical: number;
        incomeGrouped: number;
        expenseHistorical: number;
        expenseGrouped: number;
        noiHistorical: number;
        noiGrouped: number;
    };
    formatCurrency: (value: number) => string;
}) => {
    const formatLot = (value: number) => {
        if (!lotCount || lotCount <= 0) return '-';
        return formatCurrency(value / lotCount);
    };

    return (
        <div className="rounded-xl bg-white dark:bg-[#232f48] border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-white/5 flex flex-wrap gap-3 items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
                    <p className="text-xs text-slate-500 dark:text-[#92a4c9]">Est. T12 vs RR/RE income & expenses</p>
                </div>
                {lotCount ? (
                    <span className="text-xs font-semibold text-slate-600 dark:text-[#92a4c9]">
                        Lots: {lotCount}
                    </span>
                ) : null}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-[#1a2434] text-slate-500 dark:text-[#92a4c9] uppercase text-[11px]">
                        <tr>
                            <th className="px-5 py-3 text-left font-semibold">Category</th>
                            <th className="px-5 py-3 text-right font-semibold">Est. T12</th>
                            <th className="px-5 py-3 text-right font-semibold">RR</th>
                            <th className="px-5 py-3 text-right font-semibold">RE</th>
                            <th className="px-5 py-3 text-right font-semibold">Per lot</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/5 text-slate-700 dark:text-slate-200">
                        <tr className="bg-slate-100/70 dark:bg-[#182132] text-slate-600 dark:text-[#92a4c9] font-semibold">
                            <td className="px-5 py-2" colSpan={5}>
                                Income
                            </td>
                        </tr>
                        {incomeRows.map((row) => (
                            <tr key={`income-${row.label}`}>
                                <td className="px-5 py-3 text-slate-600 dark:text-[#c8d3ea]">{row.label}</td>
                                <td className="px-5 py-3 text-right font-medium text-slate-900 dark:text-white">
                                    {formatCurrency(row.historical)}
                                </td>
                                <td className="px-5 py-3 text-right font-medium text-slate-900 dark:text-white">
                                    {formatCurrency(row.grouped)}
                                </td>
                                <td className="px-5 py-3 text-right text-slate-600 dark:text-[#92a4c9]">
                                    -
                                </td>
                                <td className="px-5 py-3 text-right text-slate-600 dark:text-[#92a4c9]">
                                    {formatLot(row.grouped)}
                                </td>
                            </tr>
                        ))}
                        <tr className="bg-slate-50 dark:bg-[#1a2434] font-semibold">
                            <td className="px-5 py-3 text-slate-700 dark:text-white">Total Income</td>
                            <td className="px-5 py-3 text-right text-slate-900 dark:text-white">
                                {formatCurrency(totals.incomeHistorical)}
                            </td>
                            <td className="px-5 py-3 text-right text-slate-900 dark:text-white">
                                {formatCurrency(totals.incomeGrouped)}
                            </td>
                            <td className="px-5 py-3 text-right text-slate-600 dark:text-[#92a4c9]">
                                -
                            </td>
                            <td className="px-5 py-3 text-right text-slate-600 dark:text-[#92a4c9]">
                                {formatLot(totals.incomeGrouped)}
                            </td>
                        </tr>
                        <tr className="bg-slate-100/70 dark:bg-[#182132] text-slate-600 dark:text-[#92a4c9] font-semibold">
                            <td className="px-5 py-2" colSpan={5}>
                                Expenses
                            </td>
                        </tr>
                        {expenseRows.map((row) => (
                            <tr key={`expense-${row.label}`}>
                                <td className="px-5 py-3 text-slate-600 dark:text-[#c8d3ea]">{row.label}</td>
                                <td className="px-5 py-3 text-right font-medium text-slate-900 dark:text-white">
                                    {formatCurrency(row.historical)}
                                </td>
                                <td className="px-5 py-3 text-right font-medium text-slate-900 dark:text-white">
                                    -
                                </td>
                                <td className="px-5 py-3 text-right font-medium text-slate-900 dark:text-white">
                                    {formatCurrency(row.grouped)}
                                </td>
                                <td className="px-5 py-3 text-right text-slate-600 dark:text-[#92a4c9]">
                                    {formatLot(row.grouped)}
                                </td>
                            </tr>
                        ))}
                        <tr className="bg-slate-50 dark:bg-[#1a2434] font-semibold">
                            <td className="px-5 py-3 text-slate-700 dark:text-white">Total Expenses</td>
                            <td className="px-5 py-3 text-right text-slate-900 dark:text-white">
                                {formatCurrency(totals.expenseHistorical)}
                            </td>
                            <td className="px-5 py-3 text-right text-slate-900 dark:text-white">
                                -
                            </td>
                            <td className="px-5 py-3 text-right text-slate-900 dark:text-white">
                                {formatCurrency(totals.expenseGrouped)}
                            </td>
                            <td className="px-5 py-3 text-right text-slate-600 dark:text-[#92a4c9]">
                                {formatLot(totals.expenseGrouped)}
                            </td>
                        </tr>
                        <tr className="bg-white dark:bg-[#232f48] font-semibold">
                            <td className="px-5 py-3 text-slate-700 dark:text-white">Net Operating Income</td>
                            <td className="px-5 py-3 text-right text-slate-900 dark:text-white">
                                {formatCurrency(totals.noiHistorical)}
                            </td>
                            <td className="px-5 py-3 text-right text-slate-900 dark:text-white">
                                {formatCurrency(totals.noiGrouped)}
                            </td>
                            <td className="px-5 py-3 text-right text-slate-600 dark:text-[#92a4c9]">
                                -
                            </td>
                            <td className="px-5 py-3 text-right text-slate-600 dark:text-[#92a4c9]">
                                {formatLot(totals.noiGrouped)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export const Dashboard: React.FC<DashboardProps> = ({
    outputs,
    inputs,
    onInputChange,
    readOnly,
    shareId,
    onRefreshOutputs,
    refreshingOutputs
}) => {
    const toNumber = (value: any) => {
        if (value === null || value === undefined || value === '') return null;
        const cleaned = String(value).replace(/[$,%]/g, '').trim();
        const n = Number(cleaned);
        return Number.isFinite(n) ? n : null;
    };

    const normalizeRate = (value: any) => {
        const n = toNumber(value);
        if (n === null) return null;
        return n > 1 ? n / 100 : n;
    };

    const fmtCurrency = (v: any) => {
        const n = toNumber(v);
        if (n === null) return '-';
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
    };

    const fmtPercent = (v: any, digits = 2) => {
        const n = normalizeRate(v);
        if (n === null) return '-';
        return new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
    };

    const fmtNumber = (v: any, digits = 2) => {
        const n = toNumber(v);
        if (n === null) return '-';
        return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n);
    };

    const formatValue = (value: number | null, format: MetricItem['format']) => {
        if (format === 'currency') return fmtCurrency(value);
        if (format === 'percent') return fmtPercent(value, 2);
        return fmtNumber(value, 2);
    };

    const labelValues = outputs?.__labels || {};

    const getOutputRawFromLabels = (labels: string[], fallbackKeys: string[] = []) => {
        for (const label of labels) {
            const normalized = normalizeLabel(label);
            if (labelValues && labelValues[normalized] !== undefined && labelValues[normalized] !== '') {
                return labelValues[normalized];
            }
            if (outputs?.[normalized] !== undefined && outputs?.[normalized] !== '') {
                return outputs[normalized];
            }
        }
        for (const key of fallbackKeys) {
            if (outputs?.[key] !== undefined && outputs?.[key] !== '') return outputs[key];
        }
        return null;
    };

    const getOutputNumber = (label: string, aliases: string[] = [], fallbackKeys: string[] = []) =>
        toNumber(getOutputRawFromLabels([label, ...aliases], fallbackKeys));

    const buildSeries = (prefix: string, count: number, startYear = 1, normalizeAsRate = false): SeriesPoint[] =>
        Array.from({ length: count }, (_, idx) => {
            const year = startYear + idx;
            const raw = getOutputRawFromLabels([`${prefix}${year}`]);
            const numeric = toNumber(raw) ?? 0;
            const normalized = normalizeAsRate ? normalizeRate(raw) ?? 0 : numeric;
            return {
                label: `Y${year}`,
                value: numeric,
                normalized,
            };
        });

    const pnlData = useMemo(() => {
        const normalizePnlItems = (items: any[]): PnlItem[] =>
            Array.isArray(items)
                ? items
                      .map((item) => ({
                          id: String(item?.id ?? '').trim(),
                          name: String(item?.name ?? '').trim(),
                          amount: toNumber(item?.amount) ?? 0,
                      }))
                      .filter((item) => item.id && item.name)
                : [];

        const normalizeGrouped = (items: any[]): GroupedItem[] =>
            Array.isArray(items)
                ? items
                      .map((item) => ({
                          category: String(item?.category ?? '').trim(),
                          total: toNumber(item?.total) ?? 0,
                      }))
                      .filter((item) => item.category)
                : [];

        const normalizeAssignments = (items: any[]): PnlAssignment[] =>
            Array.isArray(items)
                ? items
                      .map((item) => ({
                          id: String(item?.id ?? '').trim(),
                          category: String(item?.category ?? '').trim(),
                      }))
                      .filter((item) => item.id && item.category)
                : [];

        const incomeItems = normalizePnlItems(inputs?.pnl_income_items);
        const expenseItems = normalizePnlItems(inputs?.pnl_expense_items);
        const groupedIncome = normalizeGrouped(inputs?.pnl_grouped_income);
        const groupedExpenses = normalizeGrouped(inputs?.pnl_grouped_expenses);
        const incomeAssignments = normalizeAssignments(inputs?.pnl_income_assignments);
        const expenseAssignments = normalizeAssignments(inputs?.pnl_expense_assignments);

        const incomeCategories = [
            { key: 'rental_income', label: 'Rental Income' },
            { key: 'rv_income', label: 'RV Income' },
            { key: 'storage', label: 'Storage' },
            { key: 'late_fees', label: 'Late Fees' },
            { key: 'utility_reimbursements', label: 'Utility Reimbursements' },
            { key: 'other_income', label: 'Other Income' },
        ];

        const expenseCategories = [
            { key: 'payroll', label: 'Payroll' },
            { key: 'utilities', label: 'Utilities' },
            { key: 'rm', label: 'Repairs & Maintenance' },
            { key: 'advertising', label: 'Advertising' },
            { key: 'ga', label: 'General & Administrative' },
            { key: 'insurance', label: 'Insurance' },
            { key: 're_taxes', label: 'Real Estate Taxes' },
            { key: 'mgmt_fee', label: 'Mgmt. Fee' },
            { key: 'reserves', label: 'Reserves' },
        ];

        const sumByCategory = (
            items: PnlItem[],
            assignments: PnlAssignment[],
            categories: { key: string; label: string }[]
        ) => {
            const totals = new Map(categories.map((cat) => [cat.key, 0]));
            const assignmentMap = new Map(assignments.map((item) => [item.id, item.category]));
            let total = 0;
            items.forEach((item) => {
                const amount = Number.isFinite(item.amount) ? item.amount : 0;
                total += amount;
                const category = assignmentMap.get(item.id);
                if (category && totals.has(category)) {
                    totals.set(category, (totals.get(category) ?? 0) + amount);
                }
            });
            return { totals, total };
        };

        const groupedMap = (items: GroupedItem[]) =>
            new Map(items.map((item) => [item.category, item.total]));

        const historicalIncome = sumByCategory(incomeItems, incomeAssignments, incomeCategories);
        const historicalExpenses = sumByCategory(expenseItems, expenseAssignments, expenseCategories);
        const groupedIncomeMap = groupedMap(groupedIncome);
        const groupedExpenseMap = groupedMap(groupedExpenses);

        const incomeRows = incomeCategories.map((cat) => ({
            label: cat.label,
            historical: historicalIncome.totals.get(cat.key) ?? 0,
            grouped: groupedIncomeMap.get(cat.key) ?? 0,
        }));

        const expenseRows = expenseCategories.map((cat) => ({
            label: cat.label,
            historical: historicalExpenses.totals.get(cat.key) ?? 0,
            grouped: groupedExpenseMap.get(cat.key) ?? 0,
        }));

        const totalIncomeGrouped = incomeRows.reduce((sum, row) => sum + row.grouped, 0);
        const totalExpenseGrouped = expenseRows.reduce((sum, row) => sum + row.grouped, 0);

        return {
            incomeRows,
            expenseRows,
            totals: {
                incomeHistorical: historicalIncome.total,
                incomeGrouped: totalIncomeGrouped,
                expenseHistorical: historicalExpenses.total,
                expenseGrouped: totalExpenseGrouped,
                noiHistorical: historicalIncome.total - historicalExpenses.total,
                noiGrouped: totalIncomeGrouped - totalExpenseGrouped,
            },
        };
    }, [inputs, toNumber]);

    const lotCount = toNumber(inputs?.total_lots);
    const showPnlTable = useMemo(
        () =>
            pnlData.incomeRows.some((row) => row.historical || row.grouped) ||
            pnlData.expenseRows.some((row) => row.historical || row.grouped),
        [pnlData]
    );

    const dollarsPerLot = getOutputNumber('$/Lot');
    const realEstateValuation = getOutputNumber('Real_Estate_Valuation');
    const equityAtAcq = getOutputNumber('Equity @ Acq.');
    const debtAtAcq = getOutputNumber('Debt @ Acq.');

    const summaryCards = useMemo(
        () => [
            {
                label: '$/Lot',
                displayLabel: '$ / Lot',
                value: dollarsPerLot,
                format: 'currency' as const,
                icon: 'payments',
                iconClass: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
            },
            {
                label: 'Real_Estate_Valuation',
                displayLabel: 'Real Estate Valuation',
                value: realEstateValuation,
                format: 'currency' as const,
                icon: 'account_balance',
                iconClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
            },
            {
                label: 'Equity @ Acq.',
                displayLabel: 'Equity @ Acquisition',
                value: equityAtAcq,
                format: 'currency' as const,
                icon: 'savings',
                iconClass: 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400',
            },
            {
                label: 'Debt @ Acq.',
                displayLabel: 'Debt @ Acquisition',
                value: debtAtAcq,
                format: 'currency' as const,
                icon: 'credit_card',
                iconClass: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400',
            },
        ],
        [dollarsPerLot, realEstateValuation, equityAtAcq, debtAtAcq]
    );

    const sourcesOfCash: MetricItem[] = useMemo(
        () => [
            {
                label: 'Equity @ Acq.',
                displayLabel: 'Equity at Acquisition',
                value: equityAtAcq,
                format: 'currency' as const,
            },
            {
                label: 'Debt @ Acq.',
                displayLabel: 'Debt at Acquisition',
                value: debtAtAcq,
                format: 'currency' as const,
            },
            {
                label: 'Total_Sources_of_Cash',
                displayLabel: 'Total Sources of Cash',
                value: getOutputNumber('Total_Sources_of_Cash'),
                format: 'currency' as const,
            },
        ],
        [equityAtAcq, debtAtAcq, outputs]
    );

    const usesOfCash: MetricItem[] = useMemo(
        () => [
            {
                label: 'RE - Purchase Price',
                displayLabel: 'RE Purchase Price',
                value: getOutputNumber('RE - Purchase Price'),
                format: 'currency' as const,
            },
            {
                label: 'RE - CAPEX',
                displayLabel: 'RE CapEx',
                value: getOutputNumber('RE - CAPEX'),
                format: 'currency' as const,
            },
            {
                label: 'RE - SCP Fee & Settlement Cost',
                displayLabel: 'RE Settlement & SCP Fee',
                value: getOutputNumber('RE - SCP Fee & Settlement Cost'),
                format: 'currency' as const,
            },
            {
                label: 'POH - Total',
                displayLabel: 'POH Total',
                value: getOutputNumber('POH - Total'),
                format: 'currency' as const,
            },
            {
                label: 'Total_Uses_of_Cash',
                displayLabel: 'Total Uses of Cash',
                value: getOutputNumber('Total_Uses_of_Cash'),
                format: 'currency' as const,
            },
        ],
        [outputs]
    );

    const rentSeries = useMemo(() => buildSeries('Rent_Year_', 5, 1, false), [outputs]);
    const noiSeries = useMemo(() => buildSeries('NOI_Year_', 5, 1, false), [outputs]);
    const taxesSeries = useMemo(() => buildSeries('Taxes_Year_', 6, 0, false), [outputs]);
    const occupancySeries = useMemo(() => buildSeries('Occupancy_Year_', 5, 1, true), [outputs]);
    const roeSeries = useMemo(() => buildSeries('ROE_Year_', 5, 1, true), [outputs]);

    const rentNoiTaxesSeries = useMemo<LineSeries[]>(() => {
        const rentValues = [0, ...rentSeries.map((item) => item.value)];
        const noiValues = [0, ...noiSeries.map((item) => item.value)];
        const taxesValues = taxesSeries.map((item) => item.value);
        return [
            { label: 'Rent', values: rentValues, color: '#2b6cee', softColor: 'rgba(43, 108, 238, 0.15)' },
            { label: 'NOI', values: noiValues, color: '#10b981', softColor: 'rgba(16, 185, 129, 0.15)' },
            { label: 'Taxes', values: taxesValues, color: '#f59e0b', softColor: 'rgba(245, 158, 11, 0.15)' },
        ];
    }, [rentSeries, noiSeries, taxesSeries]);

    const exitMetrics: MetricItem[] = useMemo(
        () => [
            {
                label: 'Market_Cap_Rate',
                displayLabel: 'Market Cap Rate',
                value: getOutputNumber('Market_Cap_Rate'),
                format: 'percent' as const,
            },
            {
                label: '5_YR_Avg_ROE',
                displayLabel: '5 Year Avg ROE',
                value: getOutputNumber('5_YR_Avg_ROE'),
                format: 'percent' as const,
            },
            {
                label: 'Cost Basis (PP + SCP Costs)',
                displayLabel: 'Cost Basis (PP + SCP)',
                value: getOutputNumber('Cost Basis (PP + SCP Costs)'),
                format: 'currency' as const,
            },
            {
                label: 'Sale Price (RE)',
                displayLabel: 'Sale Price (Real Estate)',
                value: getOutputNumber('Sale Price (RE)'),
                format: 'currency' as const,
            },
            {
                label: 'Cost of Sale',
                displayLabel: 'Cost of Sale',
                value: getOutputNumber('Cost of Sale'),
                format: 'currency' as const,
            },
            {
                label: 'Net Sales Proceeds B4 Debt Repayment',
                displayLabel: 'Net Sales Proceeds (Pre-Debt)',
                value: getOutputNumber('Net Sales Proceeds B4 Debt Repayment'),
                format: 'currency' as const,
            },
            {
                label: 'Amortizing Loan Principal',
                displayLabel: 'Amortizing Loan Principal',
                value: getOutputNumber('Amortizing Loan Principal'),
                format: 'currency' as const,
            },
            {
                label: 'Sale of POH',
                displayLabel: 'Sale of POH',
                value: getOutputNumber('Sale of POH'),
                format: 'currency' as const,
            },
            {
                label: 'Profit from Sale',
                displayLabel: 'Profit from Sale',
                value: getOutputNumber('Profit from Sale'),
                format: 'currency' as const,
            },
            {
                label: 'Exit Cap',
                displayLabel: 'Exit Cap Rate',
                value: getOutputNumber('Exit Cap'),
                format: 'percent' as const,
            },
            {
                label: 'CFADS - Profit from Ops',
                displayLabel: 'CFADS Profit (Ops)',
                value: getOutputNumber('CFADS - Profit from Ops'),
                format: 'currency' as const,
            },
            {
                label: 'Total Profit',
                displayLabel: 'Total Profit',
                value: getOutputNumber('Total Profit'),
                format: 'currency' as const,
            },
        ],
        [outputs]
    );

    const gpMetrics: MetricItem[] = useMemo(
        () => [
            {
                label: 'Property Level IRR',
                displayLabel: 'Property Level IRR',
                value: getOutputNumber('Property Level IRR'),
                format: 'percent' as const,
            },
            {
                label: 'Property Level EmX',
                displayLabel: 'Property Level EMx',
                value: getOutputNumber('Property Level EmX'),
                format: 'number' as const,
            },
            {
                label: 'Fund Level IRR',
                displayLabel: 'Fund Level IRR',
                value: getOutputNumber('Fund Level IRR'),
                format: 'percent' as const,
            },
            {
                label: 'Fund Level EmX',
                displayLabel: 'Fund Level EMx',
                value: getOutputNumber('Fund Level EmX'),
                format: 'number' as const,
            },
            {
                label: 'GP_Acq_Fee',
                displayLabel: 'GP Acquisition Fee',
                value: getOutputNumber('GP_Acq_Fee'),
                format: 'currency' as const,
            },
            {
                label: 'GP_Splilt',
                displayLabel: 'GP Split',
                value: getOutputNumber('GP_Splilt', ['GP_Split']),
                format: 'percent' as const,
            },
            {
                label: 'Total_GP_Take_Home',
                displayLabel: 'Total GP Take Home',
                value: getOutputNumber('Total_GP_Take_Home'),
                format: 'currency' as const,
            },
        ],
        [outputs]
    );

    const [copied, setCopied] = useState(false);
    const isReadOnly = readOnly || !onInputChange;
    const resolvedShareId = typeof shareId === 'string' && shareId.trim()
        ? shareId.trim()
        : typeof inputs?.spreadsheet_id === 'string' && inputs.spreadsheet_id.trim()
            ? inputs.spreadsheet_id.trim()
            : '';
    const shareUrl = resolvedShareId && typeof window !== 'undefined'
        ? `${window.location.origin}/share/${encodeURIComponent(resolvedShareId)}`
        : null;

    const handleShare = async () => {
        if (!shareUrl) return;
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Unable to copy share link', error);
        }
    };

    const projectName = inputs?.name || 'Valuation Report';
    const projectAddress = inputs?.address || 'Address pending';

    return (
        <div className="space-y-8 animate-in fade-in duration-500 text-slate-900 dark:text-white">
            <div className="flex flex-wrap justify-between items-start gap-4 pb-6 border-b border-slate-200 dark:border-[#232f48]">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-slate-900 dark:text-white text-2xl md:text-3xl font-bold tracking-tight">{projectName}</h1>
                        <span className="bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 text-xs font-bold px-2 py-1 rounded-full border border-green-200 dark:border-green-500/30">
                            ACTIVE LISTING
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 dark:text-[#92a4c9] text-sm">
                        <span className="material-symbols-outlined text-[18px]">location_on</span>
                        <p>{projectAddress}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    {!isReadOnly && onRefreshOutputs && (
                        <button
                            className="flex items-center justify-center rounded-lg h-10 px-4 bg-white dark:bg-[#232f48] hover:bg-slate-50 dark:hover:bg-[#2d3b55] text-slate-700 dark:text-white text-sm font-bold transition-colors border border-slate-200 dark:border-transparent shadow-sm"
                            onClick={onRefreshOutputs}
                            type="button"
                            disabled={refreshingOutputs}
                        >
                            <span className="material-symbols-outlined mr-2 text-[18px]">refresh</span>
                            {refreshingOutputs ? 'Refreshing...' : 'Refresh Outputs'}
                        </button>
                    )}
                    {!isReadOnly && shareUrl && (
                        <button
                            className="flex items-center justify-center rounded-lg h-10 px-4 bg-white dark:bg-[#232f48] hover:bg-slate-50 dark:hover:bg-[#2d3b55] text-slate-700 dark:text-white text-sm font-bold transition-colors border border-slate-200 dark:border-transparent shadow-sm"
                            onClick={handleShare}
                            type="button"
                        >
                            <span className="material-symbols-outlined mr-2 text-[18px]">share</span>
                            {copied ? 'Link copied!' : 'Share'}
                        </button>
                    )}
                    <button
                        className="flex items-center justify-center rounded-lg h-10 px-4 bg-[#2b6cee] hover:bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-500/20 transition-all"
                        type="button"
                        disabled={isReadOnly}
                    >
                        <span className="material-symbols-outlined mr-2 text-[18px]">download</span>
                        Download Report
                    </button>
                </div>
            </div>

            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {summaryCards.map((card) => (
                    <SummaryCard
                        key={card.label}
                        icon={card.icon}
                        iconClass={card.iconClass}
                        label={card.displayLabel}
                        value={formatValue(card.value, card.format)}
                    />
                ))}
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <MetricPanel title="Sources of Cash" items={sourcesOfCash} formatValue={formatValue} highlightLabel="Total_Sources_of_Cash" />
                <MetricPanel title="Uses of Cash" items={usesOfCash} formatValue={formatValue} highlightLabel="Total_Uses_of_Cash" />
            </section>

            {showPnlTable && (
                <section className="space-y-3">
                    <PnlComparisonTable
                        title="Income & Expenses Comparison"
                        lotCount={lotCount}
                        incomeRows={pnlData.incomeRows}
                        expenseRows={pnlData.expenseRows}
                        totals={pnlData.totals}
                        formatCurrency={fmtCurrency}
                    />
                </section>
            )}

            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Yearly Performance</h3>
                    <span className="text-xs text-slate-400 dark:text-[#92a4c9]">All values from Output Fields</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <StackedBarChart
                        title="Rent, NOI & Taxes"
                        caption="Stacked totals by year"
                        labels={['Y0', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5']}
                        series={rentNoiTaxesSeries}
                    />
                    <DualAxisLineChart
                        title="Occupancy & ROE"
                        leftLabel="Occupancy"
                        rightLabel="ROE"
                        leftSeries={occupancySeries}
                        rightSeries={roeSeries}
                        formatValue={formatValue}
                    />
                </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <MetricPanel title="Exit & Profitability" items={exitMetrics} formatValue={formatValue} />
                <MetricPanel title="GP & Fund Economics" items={gpMetrics} formatValue={formatValue} />
            </section>
        </div>
    );
};

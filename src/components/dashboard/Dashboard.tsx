"use client";

import React, { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface DashboardProps {
    outputs: any;
    inputs: any;
    onInputChange?: (data: any) => void;
    readOnly?: boolean;
    shareId?: string;
    projectId?: string | null;
    onRefreshOutputs?: () => void;
    refreshingOutputs?: boolean;
    objectiveRunNotice?: { id: number; text: string } | null;
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

type PnlComparisonRow = {
    label: string;
    historical: number | null;
    rr: number | null;
    re: number | null;
    perLot: number | null;
    format: 'currency' | 'percent' | 'number';
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
                    <span
                        className={`font-semibold ${
                            item.value !== null && item.value < 0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-slate-900 dark:text-white'
                        }`}
                    >
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
    caption,
    formatValue
}: {
    title: string;
    labels: string[];
    series: LineSeries[];
    caption?: string;
    formatValue?: (value: number) => string;
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
                            <div className="relative flex h-40 w-full max-w-[56px] flex-col justify-end rounded-lg bg-slate-100 dark:bg-[#1a2434] border border-slate-200/60 dark:border-white/5 overflow-visible">
                                {series.slice().reverse().map((line) => {
                                    const value = line.values[idx] ?? 0;
                                    const height = Math.max((value / maxTotal) * 100, 0);
                                    const displayValue =
                                        line.label.toLowerCase() === 'expenses'
                                            ? -Math.abs(value)
                                            : value;
                                    const tooltipText = `${line.label} ${label}: ${formatValue ? formatValue(displayValue) : displayValue}`;
                                    return (
                                        <div
                                            key={`${line.label}-${label}`}
                                            className="w-full"
                                            style={{ height: `${height}%`, backgroundColor: line.color }}
                                            title={tooltipText}
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

    const avgSeriesValue = (series: SeriesPoint[]) => {
        const values = series
            .map((point) => point.value)
            .filter((value): value is number => value !== null && value !== undefined);
        if (!values.length) return null;
        return values.reduce((sum, value) => sum + value, 0) / values.length;
    };

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
                <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
                    <p className="text-[11px] text-slate-400 dark:text-[#92a4c9]">Year 1-5 snapshot</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-[#92a4c9]">
                    <span className="inline-flex items-center gap-2 rounded-full bg-purple-50 dark:bg-purple-500/10 px-2.5 py-1 text-purple-600 dark:text-purple-300 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                        {leftLabel}
                        <span className="text-purple-700/80 dark:text-purple-200/80 font-semibold">
                            {formatValue(avgSeriesValue(leftSeries), 'percent')}
                        </span>
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 dark:bg-sky-500/10 px-2.5 py-1 text-sky-600 dark:text-sky-300 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                        {rightLabel}
                        <span className="text-sky-700/80 dark:text-sky-200/80 font-semibold">
                            {formatValue(avgSeriesValue(rightSeries), 'percent')}
                        </span>
                    </span>
                </div>
            </div>
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-white/5">
                <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-[#1a2434] px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#92a4c9]">
                    <span>Year</span>
                    <span>{leftLabel}</span>
                    <span>{rightLabel}</span>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-white/5 text-sm">
                    {leftSeries.map((point, index) => {
                        const rightPoint = rightSeries[index];
                        return (
                            <div
                                key={`line-values-${point.label}`}
                                className="grid grid-cols-3 gap-2 px-4 py-2 text-slate-600 dark:text-[#c8d3ea] hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors"
                            >
                                <span className="font-medium">{point.label}</span>
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
    summaryRows,
    formatValue,
}: {
    title: string;
    lotCount: number | null;
    incomeRows: PnlComparisonRow[];
    expenseRows: PnlComparisonRow[];
    totals: {
        income: PnlComparisonRow;
        expenses: PnlComparisonRow;
        noi: PnlComparisonRow;
    };
    summaryRows: PnlComparisonRow[];
    formatValue: (value: number | null, format: MetricItem['format']) => string;
}) => {
    const renderValue = (value: number | null, format: PnlComparisonRow['format']) => {
        if (value === null || value === undefined) return { text: '-', negative: false };
        return { text: formatValue(value, format), negative: value < 0 };
    };

    const renderCell = (value: number | null, format: PnlComparisonRow['format']) => {
        const rendered = renderValue(value, format);
        return (
            <span className={rendered.negative ? 'text-red-600 dark:text-red-400' : ''}>
                {rendered.text}
            </span>
        );
    };

    const resolvePerLot = (row: PnlComparisonRow) => {
        if (row.perLot !== null && row.perLot !== undefined) return row.perLot;
        if (!lotCount || lotCount <= 0 || row.re === null || row.re === undefined) return null;
        return row.re / lotCount;
    };

    return (
        <div className="rounded-xl bg-white dark:bg-[#232f48] border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-white/5 flex flex-wrap gap-3 items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
                    <p className="text-xs text-slate-500 dark:text-[#92a4c9]">Historical T-12 P&amp;L vs RR/RE income &amp; expenses</p>
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
                            <th className="px-5 py-3 text-right font-semibold">Historical T-12 P&amp;L</th>
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
                                    {renderCell(row.historical, row.format)}
                                </td>
                                <td className="px-5 py-3 text-right font-medium text-slate-900 dark:text-white">
                                    {renderCell(row.rr, row.format)}
                                </td>
                                <td className="px-5 py-3 text-right font-medium text-slate-900 dark:text-white">
                                    {renderCell(row.re, row.format)}
                                </td>
                                <td className="px-5 py-3 text-right text-slate-600 dark:text-[#92a4c9]">
                                    {renderCell(resolvePerLot(row), row.format === 'percent' ? 'percent' : 'currency')}
                                </td>
                            </tr>
                        ))}
                        <tr className="bg-slate-50 dark:bg-[#1a2434] font-semibold">
                            <td className="px-5 py-3 text-slate-700 dark:text-white">Total Income</td>
                            <td className="px-5 py-3 text-right text-slate-900 dark:text-white">
                                {renderCell(totals.income.historical, totals.income.format)}
                            </td>
                            <td className="px-5 py-3 text-right text-slate-900 dark:text-white">
                                {renderCell(totals.income.rr, totals.income.format)}
                            </td>
                            <td className="px-5 py-3 text-right text-slate-900 dark:text-white">
                                {renderCell(totals.income.re, totals.income.format)}
                            </td>
                            <td className="px-5 py-3 text-right text-slate-600 dark:text-[#92a4c9]">
                                {renderCell(resolvePerLot(totals.income), 'currency')}
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
                                    {renderCell(row.historical, row.format)}
                                </td>
                                <td className="px-5 py-3 text-right font-medium text-slate-900 dark:text-white">
                                    {renderCell(row.rr, row.format)}
                                </td>
                                <td className="px-5 py-3 text-right font-medium text-slate-900 dark:text-white">
                                    {renderCell(row.re, row.format)}
                                </td>
                                <td className="px-5 py-3 text-right text-slate-600 dark:text-[#92a4c9]">
                                    {renderCell(resolvePerLot(row), row.format === 'percent' ? 'percent' : 'currency')}
                                </td>
                            </tr>
                        ))}
                        <tr className="bg-slate-50 dark:bg-[#1a2434] font-semibold">
                            <td className="px-5 py-3 text-slate-700 dark:text-white">Total Expenses</td>
                            <td className="px-5 py-3 text-right text-slate-900 dark:text-white">
                                {renderCell(totals.expenses.historical, totals.expenses.format)}
                            </td>
                            <td className="px-5 py-3 text-right text-slate-900 dark:text-white">
                                {renderCell(totals.expenses.rr, totals.expenses.format)}
                            </td>
                            <td className="px-5 py-3 text-right text-slate-900 dark:text-white">
                                {renderCell(totals.expenses.re, totals.expenses.format)}
                            </td>
                            <td className="px-5 py-3 text-right text-slate-600 dark:text-[#92a4c9]">
                                {renderCell(resolvePerLot(totals.expenses), 'currency')}
                            </td>
                        </tr>
                        <tr className="bg-white dark:bg-[#232f48] font-semibold">
                            <td className="px-5 py-3 text-slate-700 dark:text-white">Net Operating Income</td>
                            <td className="px-5 py-3 text-right text-slate-900 dark:text-white">
                                {renderCell(totals.noi.historical, totals.noi.format)}
                            </td>
                            <td className="px-5 py-3 text-right text-slate-900 dark:text-white">
                                {renderCell(totals.noi.rr, totals.noi.format)}
                            </td>
                            <td className="px-5 py-3 text-right text-slate-900 dark:text-white">
                                {renderCell(totals.noi.re, totals.noi.format)}
                            </td>
                            <td className="px-5 py-3 text-right text-slate-600 dark:text-[#92a4c9]">
                                {renderCell(resolvePerLot(totals.noi), 'currency')}
                            </td>
                        </tr>
                        {summaryRows.map((row) => (
                            <tr key={`summary-${row.label}`} className="bg-slate-50/50 dark:bg-[#1a2434]/60">
                                <td className="px-5 py-3 text-slate-700 dark:text-white font-semibold">{row.label}</td>
                                <td className="px-5 py-3 text-right text-slate-900 dark:text-white font-medium">
                                    {renderCell(row.historical, row.format)}
                                </td>
                                <td className="px-5 py-3 text-right text-slate-900 dark:text-white font-medium">
                                    {renderCell(row.rr, row.format)}
                                </td>
                                <td className="px-5 py-3 text-right text-slate-900 dark:text-white font-medium">
                                    {renderCell(row.re, row.format)}
                                </td>
                                <td className="px-5 py-3 text-right text-slate-600 dark:text-[#92a4c9] font-medium">
                                    {renderCell(row.perLot, row.format === 'percent' ? 'percent' : 'currency')}
                                </td>
                            </tr>
                        ))}
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
    projectId,
    onRefreshOutputs,
    refreshingOutputs,
    objectiveRunNotice
}) => {
    const toNumber = (value: any) => {
        if (value === null || value === undefined || value === '') return null;
        const raw = String(value).trim();
        const isParenNegative = raw.startsWith('(') && raw.endsWith(')');
        const normalizedRaw = raw.replace(/[−–—]/g, '-');
        const cleaned = normalizedRaw
            .replace(/[()]/g, '')
            .replace(/[$,%]/g, '')
            .replace(/,/g, '')
            .replace(/x/gi, '')
            .trim();
        if (!cleaned) return null;
        const isTrailingNegative = cleaned.endsWith('-');
        const numericText = isTrailingNegative ? cleaned.slice(0, -1).trim() : cleaned;
        const n = Number(numericText);
        if (!Number.isFinite(n)) return null;
        if (isParenNegative || isTrailingNegative || normalizedRaw.startsWith('-')) {
            return -Math.abs(n);
        }
        return n;
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

    const findLabelValue = (tokens: string[]) => {
        const entries = Object.entries(labelValues || {});
        for (const [key, value] of entries) {
            const parts = key.split('_');
            if (tokens.every((token) => parts.includes(token))) {
                return value;
            }
        }
        return null;
    };

    const findLabelNumber = (tokens: string[]) => {
        const raw = findLabelValue(tokens);
        if (raw === null || raw === undefined || raw === '') return null;
        return toNumber(raw);
    };

    const findLabelNumberByAny = (tokenSets: string[][]) => {
        for (const tokens of tokenSets) {
            const value = findLabelNumber(tokens);
            if (value !== null) return value;
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
        const asArray = (value: string | string[] | null) =>
            value === null ? [] : Array.isArray(value) ? value : [value];
        const readValue = (labels: string | string[] | null, format: PnlComparisonRow['format']) => {
            const raw = getOutputRawFromLabels(asArray(labels));
            if (raw === null || raw === undefined || raw === '') return null;
            const numeric = toNumber(raw);
            if (numeric === null) return null;
            if (format === 'percent') {
                const rawText = String(raw).trim();
                if (rawText.includes('%')) return numeric;
                if (Math.abs(numeric) <= 100) return numeric;
                return null;
            }
            return numeric;
        };

        const row = (
            label: string,
            historicalLabel: string | string[] | null,
            rrLabel: string | string[] | null,
            reLabel: string | string[] | null,
            perLotLabel: string | string[] | null,
            format: PnlComparisonRow['format'] = 'currency'
        ): PnlComparisonRow => ({
            label,
            historical: readValue(historicalLabel, format),
            rr: readValue(rrLabel, format),
            re: readValue(reLabel, format),
            perLot: readValue(perLotLabel, format === 'percent' ? 'percent' : 'currency'),
            format,
        });

        const incomeRows: PnlComparisonRow[] = [
            row('Rental Income', 'Historical T-12 Rental Income', 'Current RR Rental Income', 'RE Rental Income', 'Per Lot Rental Income'),
            row('RV Income', 'Historical T-12 RV Income', 'Current RR RV Income', 'RE RV Income', 'Per Lot RV Income'),
            row('Storage Income', 'Historical T-12 Storage Income', 'Current RR Storage Income', 'RE Storage Income', 'Per Lot Storage Income'),
            row('Late Fee Income', 'Historical T-12 Late Fee Income', null, 'RE Late Fee Income', 'Per Lot Late Fee Income'),
            row(
                'Utility Reimbursements',
                'Historical T-12 Utility Reimbursements',
                null,
                'RE Utility Reimbursements',
                'Per Lot Utility Reimbursements'
            ),
            row(
                'Total Other Income',
                'Historical T-12 Total Other Income',
                null,
                'RE Total Other Income',
                'Per Lot Total Other Income'
            ),
        ];

        const expenseRows: PnlComparisonRow[] = [
            row('Payroll', 'Historical T-12 Payroll', null, 'RE Payroll', 'Per Lot Payroll'),
            row('Utilities Charges', 'Historical T-12 Utilities Charges', null, 'RE Utilities Charges', 'Per Lot Utilities Charges'),
            row(
                'Repairs and Maintenance',
                'Historical T-12 Repairs and Maintenance',
                null,
                'RE Repairs and Maintenance',
                'Per Lot Repairs and Maintenance'
            ),
            row(
                'Advertising & Promotion',
                'Historical T-12 Advertising & Promotion',
                null,
                'RE Advertising & Promotion',
                'Per Lot Advertising & Promotion'
            ),
            row(
                'General & Administrative',
                'Historical T-12 General & Administrative',
                null,
                'RE General & Administrative',
                'Per Lot General & Administrative'
            ),
            row('Insurance', 'Historical T-12 Insurance', null, 'RE Insurance', 'Per Lot Insurance'),
            row('Real Estate Taxes', 'Historical T-12 Real Estate Taxes', null, 'RE Real Estate Taxes', 'Per Lot Real Estate Taxes'),
            row('Reserve', 'Historical T-12 Reserve', null, 'RE Reserve', 'Per Lot Reserve'),
        ];

        const mgmtFeeRow = row(
            'Mgmt. Fee',
            [
                'Historical T-12 Mgmt. Fee',
                'Historical T-12 Mgmt Fee',
                'Historical T-12 Management Fee',
                'Historical T-12 Mgmt. Fees',
                'Historical T-12 Management Fees',
            ],
            [
                'Current RR Mgmt. Fee',
                'Current RR Mgmt Fee',
                'RR Mgmt. Fee',
                'RR Mgmt Fee',
                'Current RR Management Fee',
                'RR Management Fee',
                'Current RR Mgmt. Fees',
                'RR Mgmt. Fees',
            ],
            ['RE Mgmt. Fee', 'RE Mgmt Fee', 'RE Management Fee', 'RE Mgmt. Fees', 'RE Management Fees'],
            ['Per Lot Mgmt. Fee', 'Per Lot Mgmt Fee', 'Per Lot Management Fee', 'Per Lot Mgmt. Fees', 'Per Lot Management Fees']
        );

        if (mgmtFeeRow.historical === null) {
            const fallback = findLabelNumberByAny([
                ['historical', 'mgmt', 'fee'],
                ['historical', 'management', 'fee'],
                ['t12', 'mgmt', 'fee'],
                ['t12', 'management', 'fee'],
            ]);
            if (fallback !== null) mgmtFeeRow.historical = fallback;
        }
        if (mgmtFeeRow.rr === null) {
            const fallback = findLabelNumberByAny([
                ['rr', 'mgmt', 'fee'],
                ['rr', 'management', 'fee'],
                ['current', 'rr', 'mgmt', 'fee'],
                ['current', 'rr', 'management', 'fee'],
            ]);
            if (fallback !== null) mgmtFeeRow.rr = fallback;
        }
        if (mgmtFeeRow.re === null) {
            const fallback = findLabelNumberByAny([
                ['re', 'mgmt', 'fee'],
                ['re', 'management', 'fee'],
            ]);
            if (fallback !== null) mgmtFeeRow.re = fallback;
        }
        if (mgmtFeeRow.perLot === null) {
            const fallback = findLabelNumberByAny([
                ['per', 'lot', 'mgmt', 'fee'],
                ['per', 'lot', 'management', 'fee'],
            ]);
            if (fallback !== null) mgmtFeeRow.perLot = fallback;
        }

        if (mgmtFeeRow.rr === null && mgmtFeeRow.re !== null) {
            mgmtFeeRow.rr = mgmtFeeRow.re;
        }
        if (mgmtFeeRow.re === null && mgmtFeeRow.rr !== null) {
            mgmtFeeRow.re = mgmtFeeRow.rr;
        }

        expenseRows.splice(expenseRows.length - 1, 0, mgmtFeeRow);

        const rrTotalIncome = readValue(['Current RR Total Income', 'RR Total Income'], 'currency');
        const rrTotalExpenses = readValue(
            ['Current RR TOTAL EXPENSES', 'Current RR Total Expenses', 'RR TOTAL EXPENSES', 'RR Total Expenses'],
            'currency'
        );
        const rrNoiDirect = readValue(
            ['Current RR NET OPERATING INCOME', 'Current RR NOI', 'RR NET OPERATING INCOME', 'RR NOI'],
            'currency'
        );
        const rrNoiComputed =
            rrNoiDirect !== null
                ? rrNoiDirect
                : rrTotalIncome !== null && rrTotalExpenses !== null
                    ? rrTotalIncome - Math.abs(rrTotalExpenses)
                    : null;

        const totals = {
            income: row(
                'Total Income',
                'Historical T-12 Total Income',
                ['Current RR Total Income', 'RR Total Income'],
                'RE Total Income',
                'Per Lot Total Income'
            ),
            expenses: row(
                'Total Expenses',
                'Historical T-12 TOTAL EXPENSES',
                ['Current RR TOTAL EXPENSES', 'Current RR Total Expenses', 'RR TOTAL EXPENSES', 'RR Total Expenses'],
                'RE TOTAL EXPENSES',
                'Per Lot TOTAL EXPENSES'
            ),
            noi: {
                label: 'Net Operating Income',
                historical: readValue('Historical T-12 NET OPERATING INCOME', 'currency'),
                rr: rrNoiComputed,
                re: readValue('RE NET OPERATING INCOME', 'currency'),
                perLot: null,
                format: 'currency' as const,
            },
        };

        const summaryRows: PnlComparisonRow[] = [
            row('Expense Ratio', 'Historical T-12 Expense Ratio', null, 'RE Expense Ratio', null, 'percent'),
            row('Expense / Lot', 'Historical T-12 Expense / Lot', null, 'RE Expense / Lot', null, 'currency'),
            row(
                'Mgmt. Fee',
                [
                    'Historical T-12 Mgmt. Fee %',
                    'Historical T-12 Mgmt Fee %',
                    'Historical T-12 Mgmt. Fee',
                    'Historical T-12 Mgmt Fee',
                    'Historical T-12 Management Fee %',
                    'Historical T-12 Management Fee',
                ],
                [
                    'Current RR Mgmt. Fee %',
                    'Current RR Mgmt Fee %',
                    'RR Mgmt. Fee %',
                    'RR Mgmt Fee %',
                    'Current RR Management Fee %',
                    'Current RR Management Fee',
                    'RR Management Fee %',
                    'RR Management Fee',
                ],
                ['RE Mgmt. Fee %', 'RE Mgmt Fee %', 'RE Mgmt. Fee', 'RE Mgmt Fee', 'RE Management Fee %', 'RE Management Fee'],
                null,
                'percent'
            ),
            row(
                'Utility Reimbursements per occupied site',
                'Utility Reimbursements per occupied site',
                null,
                null,
                null,
                'currency'
            ),
        ];

        return { incomeRows, expenseRows, totals, summaryRows };
    }, [outputs, inputs]);

    const lotCount = toNumber(inputs?.total_lots);
    const showPnlTable = true;

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
        [dollarsPerLot, equityAtAcq, debtAtAcq]
    );

    const resolvedShareId = typeof shareId === 'string' && shareId.trim()
        ? shareId.trim()
        : typeof inputs?.spreadsheet_id === 'string' && inputs.spreadsheet_id.trim()
            ? inputs.spreadsheet_id.trim()
            : '';

    const realEstateInputRaw = inputs?.real_estate_valuation;
    const [realEstateDraft, setRealEstateDraft] = useState<string>(
        realEstateInputRaw ?? (realEstateValuation !== null && realEstateValuation !== undefined ? String(realEstateValuation) : '')
    );
    const [hasEditedRealEstate, setHasEditedRealEstate] = useState(false);
    const sliderBaseRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        if (realEstateInputRaw !== undefined && realEstateInputRaw !== null) {
            setRealEstateDraft(String(realEstateInputRaw));
        } else if (realEstateValuation !== null && realEstateValuation !== undefined) {
            setRealEstateDraft(String(realEstateValuation));
        }
    }, [realEstateInputRaw, realEstateValuation]);

    const baseCandidate = toNumber(realEstateInputRaw) ?? realEstateValuation ?? 0;
    React.useEffect(() => {
        sliderBaseRef.current = baseCandidate;
        setHasEditedRealEstate(false);
    }, [resolvedShareId]);
    React.useEffect(() => {
        if (!hasEditedRealEstate) {
            sliderBaseRef.current = baseCandidate;
        }
    }, [baseCandidate, hasEditedRealEstate]);

    const realEstateNumber = toNumber(realEstateDraft) ?? realEstateValuation ?? 0;
    const sliderBase = sliderBaseRef.current ?? baseCandidate;
    const sliderMin = sliderBase > 0 ? Math.max(0, sliderBase * 0.5) : 0;
    const sliderMax = sliderBase > 0 ? sliderBase * 1.5 : 10000000;
    const sliderStep = sliderBase > 0 ? Math.max(1000, Math.round(sliderBase / 100)) : 10000;
    const sliderValue = Math.min(Math.max(realEstateNumber, sliderMin), sliderMax);

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

    const occupancySeries = useMemo(() => buildSeries('Occupancy_Year_', 5, 1, true), [outputs]);
    const roeSeries = useMemo(() => buildSeries('ROE_Year_', 5, 1, true), [outputs]);

    const buildOutputValues = (prefix: string, count: number) =>
        Array.from({ length: count }, (_, idx) => getOutputNumber(`${prefix}${idx + 1}`) ?? 0);

    const revenueYears = useMemo(() => buildOutputValues('revenue_Year_', 5), [outputs]);
    const expenseYears = useMemo(() => buildOutputValues('expenses_Year_', 5), [outputs]);
    const noiYears = useMemo(() => buildOutputValues('noi_Year_', 5), [outputs]);
    const historicalRevenue = pnlData.totals.income.historical ?? 0;
    const historicalExpenses = pnlData.totals.expenses.historical ?? 0;
    const historicalNoi = pnlData.totals.noi.historical ?? 0;
    const revenueExpenseNoiSeries = useMemo<LineSeries[]>(
        () => [
            { label: 'Revenue', values: [historicalRevenue, ...revenueYears], color: '#2b6cee', softColor: 'rgba(43, 108, 238, 0.15)' },
            { label: 'Expenses', values: [historicalExpenses, ...expenseYears], color: '#f97316', softColor: 'rgba(249, 115, 22, 0.15)' },
            { label: 'NOI', values: [historicalNoi, ...noiYears], color: '#10b981', softColor: 'rgba(16, 185, 129, 0.15)' },
        ],
        [historicalRevenue, historicalExpenses, historicalNoi, revenueYears, expenseYears, noiYears]
    );

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
                format: 'currency' as const,
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

    const isReadOnly = readOnly || !onInputChange;

    const projectName = inputs?.name || 'Valuation Report';
    const projectAddress = inputs?.address || 'Address pending';
    const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
    const [downloadingFormat, setDownloadingFormat] = useState<'excel' | 'sheets' | null>(null);
    const [visibleObjectiveNotice, setVisibleObjectiveNotice] = useState<{ id: number; text: string } | null>(null);
    const downloadMenuRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
        if (!objectiveRunNotice?.text) return;
        setVisibleObjectiveNotice(objectiveRunNotice);
        const timer = window.setTimeout(() => {
            setVisibleObjectiveNotice((current) =>
                current?.id === objectiveRunNotice.id ? null : current
            );
        }, 15_000);
        return () => window.clearTimeout(timer);
    }, [objectiveRunNotice?.id, objectiveRunNotice?.text]);

    React.useEffect(() => {
        if (!downloadMenuOpen) return;
        const onPointerDown = (event: MouseEvent | TouchEvent) => {
            if (!downloadMenuRef.current) return;
            const target = event.target as Node | null;
            if (target && !downloadMenuRef.current.contains(target)) {
                setDownloadMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('touchstart', onPointerDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('touchstart', onPointerDown);
        };
    }, [downloadMenuOpen]);

    const buildDownloadParams = () => {
        const fileName = projectName.replace(/[^a-zA-Z0-9-_ ]+/g, '').trim() || 'valuation-report';
        const query = new URLSearchParams({
            spreadsheetId: resolvedShareId,
            fileName,
        });
        if (projectId) {
            query.set('projectId', projectId);
        }
        return query;
    };

    const handleDownloadExcel = () => {
        if (!resolvedShareId || typeof window === 'undefined') return;
        const query = buildDownloadParams();
        query.set('format', 'excel');
        setDownloadingFormat('excel');
        setDownloadMenuOpen(false);
        window.location.href = `/api/projects/download?${query.toString()}`;
        window.setTimeout(() => setDownloadingFormat(null), 1500);
    };

    const handleCreateSheetsCopy = async () => {
        if (!resolvedShareId || !projectId || typeof window === 'undefined') return;
        const query = buildDownloadParams();
        query.set('format', 'sheets');
        setDownloadingFormat('sheets');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const response = await fetch(`/api/projects/download?${query.toString()}`, {
                headers: {
                    Authorization: token ? `Bearer ${token}` : '',
                },
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload?.error || 'Failed to create Google Sheets copy');
            }
            const url = payload?.url;
            if (!url) {
                throw new Error('Google Sheets copy URL was not returned.');
            }
            const popup = window.open(url, '_blank', 'noopener,noreferrer');
            if (!popup) {
                window.location.href = url;
            }
        } catch (error: any) {
            window.alert(error?.message || 'Failed to create Google Sheets copy');
        } finally {
            setDownloadingFormat(null);
            setDownloadMenuOpen(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 text-slate-900 dark:text-white">
            {visibleObjectiveNotice && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-200">
                    {visibleObjectiveNotice.text}
                </div>
            )}
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
                    <div className="relative" ref={downloadMenuRef}>
                        <button
                            className="flex items-center justify-center rounded-lg h-10 px-4 bg-[#2b6cee] hover:bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            type="button"
                            onClick={() => setDownloadMenuOpen((prev) => !prev)}
                            disabled={!resolvedShareId || downloadingFormat !== null}
                        >
                            <span className="material-symbols-outlined mr-2 text-[18px]">download</span>
                            {downloadingFormat === 'excel'
                                ? 'Downloading...'
                                : downloadingFormat === 'sheets'
                                    ? 'Creating copy...'
                                    : 'Download Report'}
                            <span className="material-symbols-outlined ml-1 text-[18px]">expand_more</span>
                        </button>

                        {downloadMenuOpen && (
                            <div className="absolute right-0 mt-2 w-60 rounded-xl border border-slate-200 dark:border-[#2d3b55] bg-white dark:bg-[#1c273a] shadow-2xl z-20 p-2">
                                <button
                                    type="button"
                                    onClick={handleCreateSheetsCopy}
                                    disabled={downloadingFormat !== null || !projectId}
                                    className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-[#24334b] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                                        <path fill="#0F9D58" d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
                                        <path fill="#34A853" d="M14 2v5h5z" />
                                        <path fill="#fff" d="M8 11h8v1.6H8zm0 3h8v1.6H8zm0 3h5v1.6H8z" />
                                    </svg>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800 dark:text-white">Google Sheets</p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-300">
                                            {projectId ? 'Create once and open in new tab' : 'Unavailable in shared view'}
                                        </p>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleDownloadExcel}
                                    disabled={downloadingFormat !== null}
                                    className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-[#24334b] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                                        <path fill="#1D6F42" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <path fill="#2E7D32" d="M14 2v6h6z" />
                                        <path fill="#fff" d="m8.6 16 1.8-3-1.7-3h1.8l.9 1.9.9-1.9h1.7l-1.7 3 1.8 3h-1.8l-1-2.1-1 2.1z" />
                                    </svg>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800 dark:text-white">Excel (.xlsx)</p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-300">Download report file</p>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <section className="space-y-4">
                <div className="rounded-xl p-5 bg-white dark:bg-[#232f48] border border-slate-200 dark:border-white/5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                                <span className="material-symbols-outlined">account_balance</span>
                            </div>
                            <div className="flex flex-col gap-2">
                                <p className="text-slate-500 dark:text-[#92a4c9] text-sm font-medium">Real Estate Valuation</p>
                                <div className="relative">
                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                                    <input
                                        type="text"
                                        value={realEstateDraft}
                                        onChange={(e) => {
                                            setRealEstateDraft(e.target.value);
                                            if (hasEditedRealEstate) {
                                                setHasEditedRealEstate(false);
                                            }
                                            if (!isReadOnly && onInputChange) {
                                                onInputChange({ real_estate_valuation: e.target.value });
                                            }
                                        }}
                                        className="w-full rounded-md border border-transparent bg-transparent text-slate-900 dark:text-white text-2xl font-bold tracking-tight focus:outline-none focus:ring-2 focus:ring-blue-500/30 pl-5 pr-2"
                                        disabled={isReadOnly}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-3 w-full lg:max-w-sm">
                            <input
                                type="range"
                                min={sliderMin}
                                max={sliderMax}
                                step={sliderStep}
                                value={sliderValue}
                                onChange={(e) => {
                                    const nextValue = String(Math.round(Number(e.target.value)));
                                    setRealEstateDraft(nextValue);
                                    if (!hasEditedRealEstate) {
                                        setHasEditedRealEstate(true);
                                    }
                                    if (!isReadOnly && onInputChange) {
                                        onInputChange({ real_estate_valuation: nextValue });
                                    }
                                }}
                                className="w-full accent-blue-500"
                                disabled={isReadOnly}
                            />
                            <p className="text-xs text-slate-400 dark:text-[#92a4c9]">
                                {formatValue(realEstateNumber, 'currency')}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {summaryCards.map((card) => (
                        <SummaryCard
                            key={card.label}
                            icon={card.icon}
                            iconClass={card.iconClass}
                            label={card.displayLabel}
                            value={formatValue(card.value, card.format)}
                        />
                    ))}
                </div>
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
                        summaryRows={pnlData.summaryRows}
                        formatValue={formatValue}
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
                        title="Revenue, Expenses & NOI"
                        caption="Y0 reflects Historical T-12 P&L"
                        labels={['Y0', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5']}
                        series={revenueExpenseNoiSeries}
                        formatValue={fmtCurrency}
                    />
                    <DualAxisLineChart
                        title="Occupancy & ROE"
                        leftLabel="ROE"
                        rightLabel="Occupancy"
                        leftSeries={roeSeries}
                        rightSeries={occupancySeries}
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

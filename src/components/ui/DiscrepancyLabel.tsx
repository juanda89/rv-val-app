import React from 'react';
import { cn } from '@/lib/utils';

type DiscrepancyLabelProps = {
    label: string;
    fieldKey: string;
    currentValue?: any;
    pdfValues?: Record<string, any>;
    apiValues?: Record<string, any>;
    className?: string;
};

const normalizeValue = (value: any) => {
    if (value === null || value === undefined) return '';
    return String(value).trim();
};

const normalizeComparable = (value: any) =>
    normalizeValue(value).toLowerCase().replace(/[\s-]+/g, '');

export const DiscrepancyLabel = ({
    label,
    fieldKey,
    currentValue,
    pdfValues,
    apiValues,
    className,
}: DiscrepancyLabelProps) => {
    const pdfValue = pdfValues?.[fieldKey];
    const apiValue = apiValues?.[fieldKey];
    const normalizedPdf = normalizeValue(pdfValue);
    const normalizedApi = normalizeValue(apiValue);
    const normalizedCurrent = normalizeValue(currentValue);
    const hasPdfDiscrepancy =
        normalizedPdf !== '' &&
        normalizeComparable(normalizedPdf) !== normalizeComparable(normalizedCurrent);
    const hasApiDiscrepancy =
        normalizedApi !== '' &&
        normalizeComparable(normalizedApi) !== normalizeComparable(normalizedCurrent);

    return (
        <label className={cn("block text-sm font-medium text-slate-600 dark:text-gray-400 mb-2", className)}>
            <span>{label}</span>
            {hasPdfDiscrepancy && (
                <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-2 py-0.5 text-xs font-semibold">
                    PDF discrepancy: {normalizedPdf}
                </span>
            )}
            {hasApiDiscrepancy && (
                <span className="ml-2 inline-flex items-center rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 px-2 py-0.5 text-xs font-semibold">
                    API discrepancy: {normalizedApi}
                </span>
            )}
        </label>
    );
};

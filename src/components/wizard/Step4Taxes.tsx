"use client";

import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface Step4Props {
    onDataChange: (data: any) => void;
    initialData?: any;
    address?: string;
}

export const Step4Taxes: React.FC<Step4Props> = ({ onDataChange, initialData, address }) => {
    const [data, setData] = useState({
        tax_assessed_value: initialData?.tax_assessed_value || '',
        tax_year: initialData?.tax_year || '',
        tax_assessment_rate: initialData?.tax_assessment_rate || '',
        tax_millage_rate: initialData?.tax_millage_rate || '',
        tax_prev_year_amount: initialData?.tax_prev_year_amount || '',
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Sync data changes
        onDataChange(data);
    }, [data, onDataChange]);

    useEffect(() => {
        const next = {
            tax_assessed_value: initialData?.tax_assessed_value || '',
            tax_year: initialData?.tax_year || '',
            tax_assessment_rate: initialData?.tax_assessment_rate || '',
            tax_millage_rate: initialData?.tax_millage_rate || '',
            tax_prev_year_amount: initialData?.tax_prev_year_amount || '',
        };
        setData((prev) => {
            const hasChanges =
                next.tax_assessed_value !== prev.tax_assessed_value ||
                next.tax_year !== prev.tax_year ||
                next.tax_assessment_rate !== prev.tax_assessment_rate ||
                next.tax_millage_rate !== prev.tax_millage_rate ||
                next.tax_prev_year_amount !== prev.tax_prev_year_amount;
            return hasChanges ? next : prev;
        });
    }, [
        initialData?.tax_assessed_value,
        initialData?.tax_year,
        initialData?.tax_assessment_rate,
        initialData?.tax_millage_rate,
        initialData?.tax_prev_year_amount
    ]);

    const fetchRentcastData = async () => {
        if (!address) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/rentcast/property', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address }),
            });
            const json = await res.json();

            if (!res.ok) {
                throw new Error(json?.error || 'RentCast request failed');
            }

            const taxes = json?.taxes || {};

            setData((prev) => ({
                ...prev,
                tax_assessed_value: taxes.assessedValue ?? prev.tax_assessed_value,
                tax_year: taxes.taxYear ?? prev.tax_year,
                tax_prev_year_amount: taxes.taxAmount ?? prev.tax_prev_year_amount,
                tax_millage_rate: taxes.millageRate ?? prev.tax_millage_rate,
                tax_assessment_rate: taxes.assessmentRatio ?? prev.tax_assessment_rate,
            }));
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'RentCast request failed');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field: string, val: string) => {
        setData(prev => ({ ...prev, [field]: val }));
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Taxes</h2>
                        <p className="text-sm text-slate-500 dark:text-gray-400">Configure tax assumptions for Year 2.</p>
                    </div>
                    <Button onClick={fetchRentcastData} disabled={loading || !address} variant="outline" className="border-blue-500 text-blue-500 hover:bg-blue-500/10">
                        {loading ? "Fetching..." : "AI Auto-Fetch"}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-gray-400 mb-2">Assessed Value</label>
                    <div className="relative">
                        <span className="absolute left-3 top-2 text-slate-400">$</span>
                        <Input
                            type="number"
                            value={data.tax_assessed_value}
                            onChange={e => handleChange('tax_assessed_value', e.target.value)}
                            className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pl-8"
                            placeholder="0.00"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-gray-400 mb-2">Tax Year</label>
                    <Input
                        type="number"
                        value={data.tax_year}
                        onChange={e => handleChange('tax_year', e.target.value)}
                        className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                        placeholder="e.g. 2024"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-gray-400 mb-2">Assessment Ratio</label>
                    <div className="relative">
                        <Input
                            type="number"
                            value={data.tax_assessment_rate}
                            onChange={e => handleChange('tax_assessment_rate', e.target.value)}
                            className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                            placeholder="e.g. 0.8"
                            step="0.01"
                        />
                        <span className="absolute right-3 top-2 text-slate-500 text-xs">x Market Value</span>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-gray-400 mb-2">Millage Rate</label>
                    <Input
                        type="number"
                        value={data.tax_millage_rate}
                        onChange={e => handleChange('tax_millage_rate', e.target.value)}
                        className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                        placeholder="e.g. 0.02"
                        step="0.001"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-gray-400 mb-2">Previous Year Tax Amount</label>
                    <div className="relative">
                        <span className="absolute left-3 top-2 text-slate-400">$</span>
                        <Input
                            type="number"
                            value={data.tax_prev_year_amount}
                            onChange={e => handleChange('tax_prev_year_amount', e.target.value)}
                            className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pl-8"
                            placeholder="0.00"
                        />
                    </div>
                </div>
            </div>

            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-600 dark:text-red-400 text-sm">
                    {error}
                </div>
            )}
        </div>
    );
};

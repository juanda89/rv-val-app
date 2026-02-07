"use client";

import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { DiscrepancyLabel } from "@/components/ui/DiscrepancyLabel";

interface Step4Props {
    onDataChange: (data: any) => void;
    initialData?: any;
    address?: string;
}

const formatThousands = (value: string | number) => {
    if (value === null || value === undefined) return '';
    const raw = String(value).replace(/[^\d.]/g, '');
    if (!raw) return '';
    const [intPart, decPart] = raw.split('.');
    const formattedInt = Number(intPart || 0).toLocaleString('en-US');
    return decPart !== undefined && decPart !== '' ? `${formattedInt}.${decPart}` : formattedInt;
};

const normalizeCurrencyInput = (value: string) => value.replace(/[^\d.]/g, '');

export const Step4Taxes: React.FC<Step4Props> = ({ onDataChange, initialData, address }) => {
    const pdfValues = initialData?.pdf_values || {};
    const hasParcel = Boolean(initialData?.parcelNumber || initialData?.parcel_1);
    const canFetchAttom = Boolean(address || hasParcel);
    const [data, setData] = useState({
        tax_assessed_value: initialData?.tax_assessed_value ?? '',
        tax_year: initialData?.tax_year ?? '',
        tax_assessment_rate: initialData?.tax_assessment_rate ?? '',
        tax_millage_rate: initialData?.tax_millage_rate ?? '',
        tax_prev_year_amount: initialData?.tax_prev_year_amount ?? '',
        fair_market_value: initialData?.fair_market_value ?? '',
        assessed_value: initialData?.assessed_value ?? initialData?.tax_assessed_value ?? '',
        previous_year_re_taxes: initialData?.previous_year_re_taxes ?? initialData?.tax_prev_year_amount ?? '',
        us_10_year_treasury: initialData?.us_10_year_treasury ?? '',
        spread: initialData?.spread ?? '',
        spread_escalation_allowance: initialData?.spread_escalation_allowance ?? '',
        dscr: initialData?.dscr ?? '',
        max_ltc: initialData?.max_ltc ?? '',
        loan_term: initialData?.loan_term ?? '',
        interest_only_time_period: initialData?.interest_only_time_period ?? '',
        cap_rate_decompression: initialData?.cap_rate_decompression ?? '',
        real_estate_valuation: initialData?.real_estate_valuation ?? '',
        preferred_return: initialData?.preferred_return ?? '',
        lp_split: initialData?.lp_split ?? '',
        gp_split: initialData?.gp_split ?? '',
        hold_period: initialData?.hold_period ?? '',
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Sync data changes
        onDataChange(data);
    }, [data, onDataChange]);

    useEffect(() => {
        const next = {
            tax_assessed_value: initialData?.tax_assessed_value ?? '',
            tax_year: initialData?.tax_year ?? '',
            tax_assessment_rate: initialData?.tax_assessment_rate ?? '',
            tax_millage_rate: initialData?.tax_millage_rate ?? '',
            tax_prev_year_amount: initialData?.tax_prev_year_amount ?? '',
            fair_market_value: initialData?.fair_market_value ?? '',
            assessed_value: initialData?.assessed_value ?? initialData?.tax_assessed_value ?? '',
            previous_year_re_taxes: initialData?.previous_year_re_taxes ?? initialData?.tax_prev_year_amount ?? '',
            us_10_year_treasury: initialData?.us_10_year_treasury ?? '',
            spread: initialData?.spread ?? '',
            spread_escalation_allowance: initialData?.spread_escalation_allowance ?? '',
            dscr: initialData?.dscr ?? '',
            max_ltc: initialData?.max_ltc ?? '',
            loan_term: initialData?.loan_term ?? '',
            interest_only_time_period: initialData?.interest_only_time_period ?? '',
            cap_rate_decompression: initialData?.cap_rate_decompression ?? '',
            real_estate_valuation: initialData?.real_estate_valuation ?? '',
            preferred_return: initialData?.preferred_return ?? '',
            lp_split: initialData?.lp_split ?? '',
            gp_split: initialData?.gp_split ?? '',
            hold_period: initialData?.hold_period ?? '',
        };
        setData((prev) => {
            const hasChanges =
                next.tax_assessed_value !== prev.tax_assessed_value ||
                next.tax_year !== prev.tax_year ||
                next.tax_assessment_rate !== prev.tax_assessment_rate ||
                next.tax_millage_rate !== prev.tax_millage_rate ||
                next.tax_prev_year_amount !== prev.tax_prev_year_amount ||
                next.fair_market_value !== prev.fair_market_value ||
                next.assessed_value !== prev.assessed_value ||
                next.previous_year_re_taxes !== prev.previous_year_re_taxes ||
                next.us_10_year_treasury !== prev.us_10_year_treasury ||
                next.spread !== prev.spread ||
                next.spread_escalation_allowance !== prev.spread_escalation_allowance ||
                next.dscr !== prev.dscr ||
                next.max_ltc !== prev.max_ltc ||
                next.loan_term !== prev.loan_term ||
                next.interest_only_time_period !== prev.interest_only_time_period ||
                next.cap_rate_decompression !== prev.cap_rate_decompression ||
                next.real_estate_valuation !== prev.real_estate_valuation ||
                next.preferred_return !== prev.preferred_return ||
                next.lp_split !== prev.lp_split ||
                next.gp_split !== prev.gp_split ||
                next.hold_period !== prev.hold_period;
            return hasChanges ? next : prev;
        });
    }, [
        initialData?.tax_assessed_value,
        initialData?.tax_year,
        initialData?.tax_assessment_rate,
        initialData?.tax_millage_rate,
        initialData?.tax_prev_year_amount,
        initialData?.fair_market_value,
        initialData?.assessed_value,
        initialData?.previous_year_re_taxes,
        initialData?.us_10_year_treasury,
        initialData?.spread,
        initialData?.spread_escalation_allowance,
        initialData?.dscr,
        initialData?.max_ltc,
        initialData?.loan_term,
        initialData?.interest_only_time_period,
        initialData?.cap_rate_decompression,
        initialData?.real_estate_valuation,
        initialData?.preferred_return,
        initialData?.lp_split,
        initialData?.gp_split,
        initialData?.hold_period,
    ]);

    const fetchAttomData = async () => {
        if (!address && !initialData?.parcelNumber && !initialData?.parcel_1) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/attom/property', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address,
                    apn: initialData?.parcelNumber || initialData?.parcel_1,
                    fips: initialData?.fips_code,
                }),
            });
            const json = await res.json();

            if (!res.ok) {
                throw new Error(json?.error || 'ATTOM request failed');
            }

            const financials = json?.financials || {};

            setData((prev) => {
                const assessedValue = financials.assessed_value ?? prev.tax_assessed_value ?? prev.assessed_value;
                const previousTaxAmount = financials.tax_prev_year_amount ?? financials.tax_amount ?? prev.tax_prev_year_amount;
                return {
                    ...prev,
                    tax_assessed_value: assessedValue ?? prev.tax_assessed_value,
                    tax_year: financials.tax_year ?? prev.tax_year,
                    tax_prev_year_amount: previousTaxAmount ?? prev.tax_prev_year_amount,
                    tax_millage_rate: financials.millage_rate ?? prev.tax_millage_rate,
                    tax_assessment_rate: financials.assessment_ratio ?? prev.tax_assessment_rate,
                    fair_market_value: financials.market_value ?? prev.fair_market_value,
                    assessed_value: assessedValue ?? prev.assessed_value,
                    previous_year_re_taxes: previousTaxAmount ?? prev.previous_year_re_taxes,
                    us_10_year_treasury: financials.us_10_year_treasury ?? prev.us_10_year_treasury,
                };
            });
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'ATTOM request failed');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field: string, val: string) => {
        setData((prev) => {
            const next = { ...prev, [field]: val };
            if (field === 'tax_assessed_value') {
                next.assessed_value = val;
            }
            if (field === 'tax_prev_year_amount') {
                next.previous_year_re_taxes = val;
            }
            return next;
        });
    };

    const handleCurrencyChange = (field: string, val: string) => {
        handleChange(field, normalizeCurrencyInput(val));
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Taxes</h2>
                        <p className="text-sm text-slate-500 dark:text-gray-400">Configure tax assumptions for Year 2.</p>
                    </div>
                    <Button onClick={fetchAttomData} disabled={loading || !canFetchAttom} variant="outline" className="border-blue-500 text-blue-500 hover:bg-blue-500/10">
                        {loading ? "Fetching..." : "AI Auto-Fill"}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <DiscrepancyLabel
                        label="Assessed Value"
                        fieldKey="tax_assessed_value"
                        currentValue={data.tax_assessed_value}
                        pdfValues={pdfValues}
                    />
                    <div className="relative">
                        <span className="absolute left-3 top-2 text-slate-400">$</span>
                        <Input
                            type="text"
                            value={formatThousands(data.tax_assessed_value)}
                            onChange={e => handleCurrencyChange('tax_assessed_value', e.target.value)}
                            className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pl-8"
                            placeholder="0.00"
                        />
                    </div>
                </div>

                <div>
                    <DiscrepancyLabel
                        label="Tax Year"
                        fieldKey="tax_year"
                        currentValue={data.tax_year}
                        pdfValues={pdfValues}
                    />
                    <Input
                        type="number"
                        value={data.tax_year}
                        onChange={e => handleChange('tax_year', e.target.value)}
                        className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                        placeholder="e.g. 2024"
                    />
                </div>

                <div>
                    <DiscrepancyLabel
                        label="Assessment Ratio"
                        fieldKey="tax_assessment_rate"
                        currentValue={data.tax_assessment_rate}
                        pdfValues={pdfValues}
                    />
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
                    <DiscrepancyLabel
                        label="Millage Rate"
                        fieldKey="tax_millage_rate"
                        currentValue={data.tax_millage_rate}
                        pdfValues={pdfValues}
                    />
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
                    <DiscrepancyLabel
                        label="Previous Year Tax Amount"
                        fieldKey="tax_prev_year_amount"
                        currentValue={data.tax_prev_year_amount}
                        pdfValues={pdfValues}
                    />
                    <div className="relative">
                        <span className="absolute left-3 top-2 text-slate-400">$</span>
                        <Input
                            type="text"
                            value={formatThousands(data.tax_prev_year_amount)}
                            onChange={e => handleCurrencyChange('tax_prev_year_amount', e.target.value)}
                            className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pl-8"
                            placeholder="0.00"
                        />
                    </div>
                </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-white/10">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Tax Reference</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <DiscrepancyLabel
                            label="Fair Market Value"
                            fieldKey="fair_market_value"
                            currentValue={data.fair_market_value}
                            pdfValues={pdfValues}
                        />
                        <Input
                            value={formatThousands(data.fair_market_value)}
                            onChange={e => handleCurrencyChange('fair_market_value', e.target.value)}
                            className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200 dark:border-white/10">
                <div>
                    <DiscrepancyLabel
                        label="US 10 Year Treasury (%)"
                        fieldKey="us_10_year_treasury"
                        currentValue={data.us_10_year_treasury}
                        pdfValues={pdfValues}
                    />
                    <Input
                        value={data.us_10_year_treasury}
                        onChange={e => handleChange('us_10_year_treasury', e.target.value)}
                        className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="Spread (%)"
                        fieldKey="spread"
                        currentValue={data.spread}
                        pdfValues={pdfValues}
                    />
                    <Input
                        value={data.spread}
                        onChange={e => handleChange('spread', e.target.value)}
                        className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="Spread Escalation Allowance (%)"
                        fieldKey="spread_escalation_allowance"
                        currentValue={data.spread_escalation_allowance}
                        pdfValues={pdfValues}
                    />
                    <Input
                        value={data.spread_escalation_allowance}
                        onChange={e => handleChange('spread_escalation_allowance', e.target.value)}
                        className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="DSCR"
                        fieldKey="dscr"
                        currentValue={data.dscr}
                        pdfValues={pdfValues}
                    />
                    <Input
                        value={data.dscr}
                        onChange={e => handleChange('dscr', e.target.value)}
                        className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="Max LTC (%)"
                        fieldKey="max_ltc"
                        currentValue={data.max_ltc}
                        pdfValues={pdfValues}
                    />
                    <Input
                        value={data.max_ltc}
                        onChange={e => handleChange('max_ltc', e.target.value)}
                        className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="Loan Term (Years)"
                        fieldKey="loan_term"
                        currentValue={data.loan_term}
                        pdfValues={pdfValues}
                    />
                    <Input
                        value={data.loan_term}
                        onChange={e => handleChange('loan_term', e.target.value)}
                        className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="Interest Only Time Period (Years)"
                        fieldKey="interest_only_time_period"
                        currentValue={data.interest_only_time_period}
                        pdfValues={pdfValues}
                    />
                    <Input
                        value={data.interest_only_time_period}
                        onChange={e => handleChange('interest_only_time_period', e.target.value)}
                        className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="Cap Rate Decompression (%)"
                        fieldKey="cap_rate_decompression"
                        currentValue={data.cap_rate_decompression}
                        pdfValues={pdfValues}
                    />
                    <Input
                        value={data.cap_rate_decompression}
                        onChange={e => handleChange('cap_rate_decompression', e.target.value)}
                        className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="Preferred Return (%)"
                        fieldKey="preferred_return"
                        currentValue={data.preferred_return}
                        pdfValues={pdfValues}
                    />
                    <Input
                        value={data.preferred_return}
                        onChange={e => handleChange('preferred_return', e.target.value)}
                        className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="LP Split (%)"
                        fieldKey="lp_split"
                        currentValue={data.lp_split}
                        pdfValues={pdfValues}
                    />
                    <Input
                        value={data.lp_split}
                        onChange={e => handleChange('lp_split', e.target.value)}
                        className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="GP Split (%)"
                        fieldKey="gp_split"
                        currentValue={data.gp_split}
                        pdfValues={pdfValues}
                    />
                    <Input
                        value={data.gp_split}
                        onChange={e => handleChange('gp_split', e.target.value)}
                        className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="Hold Period (Years)"
                        fieldKey="hold_period"
                        currentValue={data.hold_period}
                        pdfValues={pdfValues}
                    />
                    <Input
                        value={data.hold_period}
                        onChange={e => handleChange('hold_period', e.target.value)}
                        className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                    />
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

"use client";

import React, { useMemo, useState } from 'react';

interface DashboardProps {
    outputs: any;
    inputs: any;
    onInputChange?: (data: any) => void;
    readOnly?: boolean;
    shareId?: string;
}

type BreakdownItem = { name?: string; category?: string; amount?: number; total?: number };
type Scenario = 'conservative' | 'base' | 'optimistic';

export const Dashboard: React.FC<DashboardProps> = ({ outputs, inputs, onInputChange, readOnly, shareId }) => {
    const toNumber = (value: any) => {
        const n = Number(value);
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

    const fmtPercent = (v: any, digits = 1) => {
        const n = toNumber(v);
        if (n === null) return '-';
        return new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
    };

    const valuation = toNumber(outputs?.valuation_price);
    const noiAnnual = toNumber(outputs?.noi_annual);
    const equityNeeded = toNumber(outputs?.equity_needed);
    const capRate = normalizeRate(outputs?.cap_rate_entry) ?? (valuation && noiAnnual ? noiAnnual / valuation : null);

    const totalLots = toNumber(inputs?.total_lots);
    const occupiedLots = toNumber(inputs?.occupied_lots);
    const currentOccupancy = totalLots && occupiedLots ? occupiedLots / totalLots : null;

    const groupedIncome = Array.isArray(inputs?.pnl_grouped_income) ? inputs.pnl_grouped_income : [];
    const groupedExpenses = Array.isArray(inputs?.pnl_grouped_expenses) ? inputs.pnl_grouped_expenses : [];
    const originalIncome = Array.isArray(inputs?.pnl_income_items) ? inputs.pnl_income_items : [];
    const originalExpenses = Array.isArray(inputs?.pnl_expense_items) ? inputs.pnl_expense_items : [];

    const incomeBreakdown: BreakdownItem[] = groupedIncome.length > 0 ? groupedIncome : originalIncome;
    const expenseBreakdown: BreakdownItem[] = groupedExpenses.length > 0 ? groupedExpenses : originalExpenses;

    const [recalculating, setRecalculating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [scenario, setScenario] = useState<Scenario>('base');
    const isReadOnly = readOnly || !onInputChange;
    const resolvedShareId = typeof shareId === 'string' && shareId.trim()
        ? shareId.trim()
        : typeof inputs?.spreadsheet_id === 'string' && inputs.spreadsheet_id.trim()
            ? inputs.spreadsheet_id.trim()
            : '';
    const shareUrl = resolvedShareId && typeof window !== 'undefined'
        ? `${window.location.origin}/share/${encodeURIComponent(resolvedShareId)}`
        : null;

    const driverValues = useMemo(() => {
        const annualRentGrowth = normalizeRate(inputs?.annual_rent_growth) ?? 0.03;
        const expenseInflation = normalizeRate(inputs?.expense_inflation) ?? 0.02;
        const exitCapRate = normalizeRate(inputs?.exit_cap_rate) ?? capRate ?? 0.08;
        const occupancyTarget = normalizeRate(inputs?.occupancy_target) ?? currentOccupancy ?? 0.9;

        return {
            annualRentGrowth,
            expenseInflation,
            exitCapRate,
            occupancyTarget,
        };
    }, [inputs?.annual_rent_growth, inputs?.expense_inflation, inputs?.exit_cap_rate, inputs?.occupancy_target, capRate, currentOccupancy]);

    const totals = useMemo(() => {
        const incomeTotal = incomeBreakdown.reduce((sum, item) => sum + Number(item.total ?? item.amount ?? 0), 0);
        const expenseTotal = expenseBreakdown.reduce((sum, item) => sum + Number(item.total ?? item.amount ?? 0), 0);
        return { incomeTotal, expenseTotal };
    }, [incomeBreakdown, expenseBreakdown]);

    const baseRevenue = totals.incomeTotal > 0 ? totals.incomeTotal : (noiAnnual ? noiAnnual / 0.6 : null);
    const baseExpenses = totals.expenseTotal > 0
        ? totals.expenseTotal
        : (baseRevenue !== null && noiAnnual !== null ? baseRevenue - noiAnnual : null);

    const scenarioConfig = useMemo(() => {
        const conservative = {
            rentGrowth: Math.max(driverValues.annualRentGrowth - 0.01, 0),
            expenseInflation: driverValues.expenseInflation + 0.005,
        };
        const optimistic = {
            rentGrowth: driverValues.annualRentGrowth + 0.01,
            expenseInflation: Math.max(driverValues.expenseInflation - 0.005, 0),
        };
        const base = {
            rentGrowth: driverValues.annualRentGrowth,
            expenseInflation: driverValues.expenseInflation,
        };
        if (scenario === 'conservative') return conservative;
        if (scenario === 'optimistic') return optimistic;
        return base;
    }, [scenario, driverValues.annualRentGrowth, driverValues.expenseInflation]);

    const projectionRows = useMemo(() => {
        if (!baseRevenue || !baseExpenses) return [];
        return Array.from({ length: 5 }, (_, i) => {
            const year = i + 1;
            const revenue = baseRevenue * Math.pow(1 + scenarioConfig.rentGrowth, year);
            const expenses = baseExpenses * Math.pow(1 + scenarioConfig.expenseInflation, year);
            const noi = revenue - expenses;
            const margin = revenue ? noi / revenue : null;
            return { year, revenue, expenses, noi, margin };
        });
    }, [baseRevenue, baseExpenses, scenarioConfig.rentGrowth, scenarioConfig.expenseInflation]);

    const scenarioCards = useMemo(() => {
        if (!noiAnnual || !driverValues.exitCapRate) {
            return [
                { label: 'Conservative', capRate: null, value: null },
                { label: 'Base Case', capRate: null, value: null },
                { label: 'Optimistic', capRate: null, value: null },
            ];
        }
        const base = driverValues.exitCapRate;
        const conservative = Math.min(base + 0.005, 0.2);
        const optimistic = Math.max(base - 0.005, 0.02);
        return [
            { label: 'Conservative', capRate: conservative, value: noiAnnual / conservative },
            { label: 'Base Case', capRate: base, value: noiAnnual / base },
            { label: 'Optimistic', capRate: optimistic, value: noiAnnual / optimistic },
        ];
    }, [noiAnnual, driverValues.exitCapRate]);

    const chartMax = projectionRows.reduce((max, row) => Math.max(max, row.revenue || 0, row.noi || 0), 0) || 1;

    const handleDriverChange = (key: string, value: number) => {
        if (!onInputChange || isReadOnly) return;
        onInputChange({ [key]: value });
    };

    const handleRecalculate = () => {
        if (!onInputChange || isReadOnly) return;
        setRecalculating(true);
        onInputChange({});
        setTimeout(() => setRecalculating(false), 900);
    };

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

    const cashOnCash = noiAnnual && equityNeeded ? noiAnnual / equityNeeded : null;
    const mapCenter = inputs?.lat && inputs?.lng
        ? `${inputs.lat},${inputs.lng}`
        : inputs?.address
            ? encodeURIComponent(inputs.address)
            : '';
    const mapUrl = mapCenter
        ? `https://maps.googleapis.com/maps/api/staticmap?center=${mapCenter}&zoom=15&size=640x360&maptype=roadmap&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`
        : '';

    const projectName = inputs?.name || 'Valuation Report';
    const projectAddress = inputs?.address || 'Address pending';

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-wrap justify-between items-start gap-4 pb-6 border-b border-[#232f48]">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-white text-2xl md:text-3xl font-bold tracking-tight">{projectName}</h1>
                        <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-1 rounded-full border border-green-500/30">
                            ACTIVE LISTING
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-[#92a4c9] text-sm">
                        <span className="material-symbols-outlined text-[18px]">location_on</span>
                        <p>{projectAddress}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    {!isReadOnly && shareUrl && (
                        <button
                            className="flex items-center justify-center rounded-lg h-10 px-4 bg-[#232f48] hover:bg-[#2d3b55] text-white text-sm font-bold transition-colors"
                            onClick={handleShare}
                            type="button"
                        >
                            <span className="material-symbols-outlined mr-2 text-[18px]">share</span>
                            {copied ? 'Link copied!' : 'Share'}
                        </button>
                    )}
                    <button
                        className="flex items-center justify-center rounded-lg h-10 px-4 bg-[#2b6cee] hover:bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-900/20 transition-all"
                        type="button"
                        disabled={isReadOnly}
                    >
                        <span className="material-symbols-outlined mr-2 text-[18px]">download</span>
                        Download Report
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="flex items-center gap-4 rounded-xl p-4 bg-[#232f48] border border-white/5 shadow-sm">
                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                        <span className="material-symbols-outlined">monetization_on</span>
                    </div>
                    <div>
                        <p className="text-[#92a4c9] text-sm font-medium">Est. Market Value</p>
                        <p className="text-white text-2xl font-bold tracking-tight">{fmtCurrency(valuation)}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4 rounded-xl p-4 bg-[#232f48] border border-white/5 shadow-sm">
                    <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                        <span className="material-symbols-outlined">percent</span>
                    </div>
                    <div>
                        <p className="text-[#92a4c9] text-sm font-medium">Cap Rate</p>
                        <p className="text-white text-2xl font-bold tracking-tight">{fmtPercent(capRate)}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4 rounded-xl p-4 bg-[#232f48] border border-white/5 shadow-sm">
                    <div className="p-2 bg-orange-500/10 rounded-lg text-orange-400">
                        <span className="material-symbols-outlined">trending_up</span>
                    </div>
                    <div>
                        <p className="text-[#92a4c9] text-sm font-medium">Cash-on-Cash Return</p>
                        <p className="text-white text-2xl font-bold tracking-tight">{fmtPercent(cashOnCash)}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4 rounded-xl p-4 bg-[#232f48] border border-white/5 shadow-sm">
                    <div className="p-2 bg-teal-500/10 rounded-lg text-teal-400">
                        <span className="material-symbols-outlined">bed</span>
                    </div>
                    <div>
                        <p className="text-[#92a4c9] text-sm font-medium">Current Occupancy</p>
                        <p className="text-white text-2xl font-bold tracking-tight">{fmtPercent(currentOccupancy, 0)}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <section className="rounded-xl bg-[#232f48] border border-white/5 overflow-hidden">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 pb-2 border-b border-white/5 gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-white">Financial Projections</h3>
                                <p className="text-sm text-[#92a4c9] mt-1">5-year forecast based on current inputs</p>
                            </div>
                            <div className="flex h-9 bg-[#111722] rounded-lg p-1">
                                {(['conservative', 'base', 'optimistic'] as Scenario[]).map((item) => (
                                    <button
                                        key={item}
                                        className={`flex-1 px-3 text-xs font-medium rounded-md transition-colors ${scenario === item ? 'bg-[#232f48] text-white shadow-sm border border-white/5' : 'text-[#92a4c9] hover:text-white'}`}
                                        onClick={() => setScenario(item)}
                                        type="button"
                                    >
                                        {item === 'base' ? 'Base Case' : item.charAt(0).toUpperCase() + item.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="relative h-64 w-full mt-4 flex items-end justify-between gap-2 sm:gap-4 text-xs text-[#92a4c9]">
                                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                                    {Array.from({ length: 5 }).map((_, idx) => (
                                        <div key={idx} className="border-t border-white/5 w-full h-0"></div>
                                    ))}
                                </div>
                                {projectionRows.map((row) => {
                                    const revenueHeight = Math.round((row.revenue / chartMax) * 100);
                                    const noiHeight = Math.round((row.noi / chartMax) * 100);
                                    return (
                                        <div key={row.year} className="relative flex flex-col items-center flex-1 h-full justify-end group">
                                            <div className="absolute -top-10 bg-gray-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                                Rev: {fmtCurrency(row.revenue)} | NOI: {fmtCurrency(row.noi)}
                                            </div>
                                            <div className="flex gap-1 items-end h-full w-full justify-center">
                                                <div className="w-1/3 bg-[#2b6cee] rounded-t-sm transition-colors" style={{ height: `${revenueHeight}%` }}></div>
                                                <div className="w-1/3 bg-teal-500 rounded-t-sm transition-colors" style={{ height: `${noiHeight}%` }}></div>
                                            </div>
                                            <span className="mt-3">{2023 + row.year}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex justify-center gap-6 mt-6">
                                <div className="flex items-center gap-2">
                                    <div className="size-3 rounded-full bg-[#2b6cee]"></div>
                                    <span className="text-xs text-[#92a4c9]">Gross Revenue</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="size-3 rounded-full bg-teal-500"></div>
                                    <span className="text-xs text-[#92a4c9]">Net Operating Income (NOI)</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-xl bg-[#232f48] border border-white/5 overflow-hidden">
                        <div className="p-6 pb-4 border-b border-white/5">
                            <h3 className="text-lg font-bold text-white">Detailed Breakdown</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-[#111722] text-[#92a4c9] uppercase text-xs font-semibold">
                                    <tr>
                                        <th className="px-6 py-4">Fiscal Year</th>
                                        <th className="px-6 py-4">Gross Revenue</th>
                                        <th className="px-6 py-4">Op. Expenses</th>
                                        <th className="px-6 py-4">EBITDA</th>
                                        <th className="px-6 py-4">NOI Margin</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-gray-300">
                                    {projectionRows.length === 0 && (
                                        <tr>
                                            <td className="px-6 py-4 text-[#92a4c9]" colSpan={5}>Projections will appear once NOI is available.</td>
                                        </tr>
                                    )}
                                    {projectionRows.map((row) => (
                                        <tr key={row.year} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 font-medium text-white">{2023 + row.year} (Y{row.year})</td>
                                            <td className="px-6 py-4">{fmtCurrency(row.revenue)}</td>
                                            <td className="px-6 py-4 text-red-400">({fmtCurrency(row.expenses)})</td>
                                            <td className="px-6 py-4 text-green-400 font-bold">{fmtCurrency(row.noi)}</td>
                                            <td className="px-6 py-4">{fmtPercent(row.margin)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

                <div className="flex flex-col gap-6">
                    <section className="rounded-xl bg-[#232f48] border border-white/5 p-6 flex flex-col gap-5">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-white">Valuation Drivers</h3>
                            <span className="material-symbols-outlined text-[#92a4c9]" title="Adjust these inputs to recalculate valuation">info</span>
                        </div>
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-[#92a4c9]">Annual Rent Growth</span>
                                    <span className="text-white font-bold">{fmtPercent(driverValues.annualRentGrowth)}</span>
                                </div>
                                <input
                                    className="w-full h-2 bg-[#111722] rounded-lg appearance-none cursor-pointer accent-[#2b6cee]"
                                    max="0.12"
                                    min="0"
                                    step="0.0025"
                                    type="range"
                                    value={driverValues.annualRentGrowth}
                                    onChange={(e) => handleDriverChange('annual_rent_growth', parseFloat(e.target.value))}
                                    disabled={isReadOnly}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-[#92a4c9]">Expense Inflation</span>
                                    <span className="text-white font-bold">{fmtPercent(driverValues.expenseInflation)}</span>
                                </div>
                                <input
                                    className="w-full h-2 bg-[#111722] rounded-lg appearance-none cursor-pointer accent-[#2b6cee]"
                                    max="0.1"
                                    min="0"
                                    step="0.0025"
                                    type="range"
                                    value={driverValues.expenseInflation}
                                    onChange={(e) => handleDriverChange('expense_inflation', parseFloat(e.target.value))}
                                    disabled={isReadOnly}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-[#92a4c9]">Exit Cap Rate</span>
                                    <span className="text-white font-bold">{fmtPercent(driverValues.exitCapRate)}</span>
                                </div>
                                <input
                                    className="w-full h-2 bg-[#111722] rounded-lg appearance-none cursor-pointer accent-[#2b6cee]"
                                    max="0.12"
                                    min="0.04"
                                    step="0.0025"
                                    type="range"
                                    value={driverValues.exitCapRate}
                                    onChange={(e) => handleDriverChange('exit_cap_rate', parseFloat(e.target.value))}
                                    disabled={isReadOnly}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-[#92a4c9]">Occupancy Target</span>
                                    <span className="text-white font-bold">{fmtPercent(driverValues.occupancyTarget, 0)}</span>
                                </div>
                                <input
                                    className="w-full h-2 bg-[#111722] rounded-lg appearance-none cursor-pointer accent-[#2b6cee]"
                                    max="1"
                                    min="0.6"
                                    step="0.01"
                                    type="range"
                                    value={driverValues.occupancyTarget}
                                    onChange={(e) => handleDriverChange('occupancy_target', parseFloat(e.target.value))}
                                    disabled={isReadOnly}
                                />
                            </div>
                        </div>
                        <div className="pt-2">
                            <button
                                className="w-full rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold py-3 text-sm transition-colors border border-white/10 flex items-center justify-center gap-2"
                                type="button"
                                onClick={handleRecalculate}
                                disabled={isReadOnly}
                            >
                                <span className="material-symbols-outlined text-[18px]">refresh</span>
                                {recalculating ? 'Recalculating...' : 'Recalculate Valuation'}
                            </button>
                        </div>
                    </section>

                    <section className="rounded-xl bg-[#232f48] border border-white/5 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-white/5 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#92a4c9] text-[18px]">location_on</span>
                            <h3 className="text-base font-bold text-white">Location</h3>
                        </div>
                        <div className="relative h-56 w-full bg-neutral-800">
                            {mapUrl ? (
                                <img src={mapUrl} alt="Property map" className="absolute inset-0 w-full h-full object-cover opacity-70" />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-xs text-[#92a4c9]">
                                    Map preview will appear once address is set.
                                </div>
                            )}
                            <div className="absolute bottom-3 right-3 bg-white text-[#101622] text-[10px] px-3 py-1 rounded-full font-bold">
                                RV Park
                            </div>
                        </div>
                        <div className="p-4">
                            <p className="text-sm text-[#92a4c9]">{projectAddress}</p>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

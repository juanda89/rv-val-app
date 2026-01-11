"use client";

import React from 'react';
import { Input } from "@/components/ui/Input";

interface DashboardProps {
    outputs: any;
    inputs: any;
    onInputChange: (data: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ outputs, inputs, onInputChange }) => {
    // Format currency
    const fmt = (v: any) => {
        const n = Number(v);
        if (isNaN(n)) return v || '-';
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
    };

    const fmtPercent = (v: any) => {
        const n = Number(v);
        if (isNaN(n)) return v || '-';
        return new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1 }).format(n);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold text-white">Valuation Summary</h2>
                <p className="text-gray-400">Real-time valuation based on your inputs.</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#1a2228] p-6 rounded-xl border border-[#283339] shadow-lg">
                    <p className="text-sm text-gray-400 uppercase tracking-wider font-semibold">Valuation Price</p>
                    <p className="text-3xl font-bold text-green-400 mt-2">{fmt(outputs?.valuation_price)}</p>
                </div>
                <div className="bg-[#1a2228] p-6 rounded-xl border border-[#283339]">
                    <p className="text-sm text-gray-400 uppercase tracking-wider font-semibold">Annual NOI</p>
                    <p className="text-2xl font-bold text-white mt-2">{fmt(outputs?.noi_annual)}</p>
                </div>
                <div className="bg-[#1a2228] p-6 rounded-xl border border-[#283339]">
                    <p className="text-sm text-gray-400 uppercase tracking-wider font-semibold">Equity Needed</p>
                    <p className="text-2xl font-bold text-white mt-2">{fmt(outputs?.equity_needed)}</p>
                </div>
            </div>

            {/* Sensitivity Analysis */}
            <div className="bg-[#1a2228] p-8 rounded-xl border border-[#283339]">
                <h3 className="text-lg font-bold text-white mb-6">Sensitivity Analysis</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Exit Cap Rate: {fmtPercent(inputs?.cap_rate_entry || 0.07)}</label>
                        <input
                            type="range"
                            min="0.04"
                            max="0.12"
                            step="0.0025"
                            value={inputs?.cap_rate_entry || 0.07}
                            onChange={(e) => onInputChange({ cap_rate_entry: parseFloat(e.target.value) })}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-2">
                            <span>4%</span>
                            <span>12%</span>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">LTV (Loan to Value)</label>
                        {/*  Add LTV Logic if mapping exists. Mapping has cap_rate_entry at H12. 
                      LTV might be an input? Mapping: max_loan_amount is H15. 
                      Let's assume "LTV" is an input not yet in "inputs" mapping but maybe we can add it or just play with Cap Rate for now.
                      Roadmap says: "Add Sliders/Inputs for variables like 'Exit Cap Rate' or 'Loan LTV'".
                      I will stick to Cap Rate as it's clearly mapped.
                 */}
                        <div className="text-sm text-gray-500 italic mt-2">
                            LTV Slider functionality pending sheet mapping update.
                        </div>
                    </div>
                </div>
            </div>

            {/* Detailed Metrics Table */}
            <div className="overflow-hidden border border-[#283339] rounded-xl">
                <table className="w-full text-sm text-left text-gray-400">
                    <thead className="text-xs text-gray-200 uppercase bg-[#283339]">
                        <tr>
                            <th className="px-6 py-3">Metric</th>
                            <th className="px-6 py-3">Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-[#283339]">
                            <td className="px-6 py-4">Max Loan Amount</td>
                            <td className="px-6 py-4 text-white font-medium">{fmt(outputs?.max_loan_amount)}</td>
                        </tr>
                        {/* Add more output rows here */}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

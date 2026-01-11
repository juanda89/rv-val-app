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
        tax_assessment_rate: initialData?.tax_assessment_rate || '',
        tax_millage_rate: initialData?.tax_millage_rate || '',
        tax_prev_year_amount: initialData?.tax_prev_year_amount || '',
    });

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Sync data changes
        onDataChange(data);
    }, [data, onDataChange]);

    const fetchAttomData = async () => {
        if (!address) return;
        setLoading(true);
        try {
            // Mock API call - replace with actual endpoint
            // const res = await fetch(\`/api/taxes?address=\${encodeURIComponent(address)}\`);
            // const json = await res.json();

            // Mock response
            setTimeout(() => {
                setData({
                    tax_assessment_rate: '0.80', // 80%
                    tax_millage_rate: '0.015', // 1.5%
                    tax_prev_year_amount: '12000'
                });
                setLoading(false);
            }, 1000);
        } catch (err) {
            console.error(err);
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
                        <h2 className="text-xl font-bold text-white">Taxes</h2>
                        <p className="text-sm text-gray-400">Configure tax assumptions for Year 2.</p>
                    </div>
                    <Button onClick={fetchAttomData} disabled={loading || !address} variant="outline" className="border-blue-500 text-blue-400 hover:bg-blue-500/10">
                        {loading ? "Fetching..." : "Auto-Fetch from ATTOM"}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Assessment Ratio</label>
                    <div className="relative">
                        <Input
                            type="number"
                            value={data.tax_assessment_rate}
                            onChange={e => handleChange('tax_assessment_rate', e.target.value)}
                            className="bg-[#283339] text-white border-transparent"
                            placeholder="e.g. 0.8"
                            step="0.01"
                        />
                        <span className="absolute right-3 top-2 text-gray-500 text-xs">x Market Value</span>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Millage Rate</label>
                    <Input
                        type="number"
                        value={data.tax_millage_rate}
                        onChange={e => handleChange('tax_millage_rate', e.target.value)}
                        className="bg-[#283339] text-white border-transparent"
                        placeholder="e.g. 0.02"
                        step="0.001"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Previous Year Tax Amount</label>
                    <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-400">$</span>
                        <Input
                            type="number"
                            value={data.tax_prev_year_amount}
                            onChange={e => handleChange('tax_prev_year_amount', e.target.value)}
                            className="bg-[#283339] text-white border-transparent pl-8"
                            placeholder="0.00"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

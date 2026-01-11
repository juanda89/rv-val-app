"use client";

import React, { useEffect, useState } from 'react';
import { Input } from "@/components/ui/Input";

interface Step2Props {
    onDataChange: (data: any) => void;
    initialData?: any;
}

export const Step2RentRoll: React.FC<Step2Props> = ({ onDataChange, initialData }) => {
    const [inputs, setInputs] = useState({
        total_lots: initialData?.total_lots || '',
        occupied_lots: initialData?.occupied_lots || '',
        current_lot_rent: initialData?.current_lot_rent || '',
    });

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Basic validation
        if (Number(inputs.occupied_lots) > Number(inputs.total_lots)) {
            setError('Occupied lots cannot exceed Total lots');
        } else {
            setError(null);
            onDataChange(inputs);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inputs]);

    useEffect(() => {
        const next = {
            total_lots: initialData?.total_lots || '',
            occupied_lots: initialData?.occupied_lots || '',
            current_lot_rent: initialData?.current_lot_rent || '',
        };
        const hasChanges =
            next.total_lots !== inputs.total_lots ||
            next.occupied_lots !== inputs.occupied_lots ||
            next.current_lot_rent !== inputs.current_lot_rent;

        if (hasChanges) {
            setInputs(next);
        }
    }, [initialData?.total_lots, initialData?.occupied_lots, initialData?.current_lot_rent]);

    const handleChange = (field: string, value: string) => {
        setInputs(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3">
                <h2 className="text-xl font-bold text-white">Rent Roll</h2>
                <p className="text-sm text-gray-400">Enter the current occupancy and rent details.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Total Lots</label>
                    <Input
                        type="number"
                        value={inputs.total_lots}
                        onChange={(e) => handleChange('total_lots', e.target.value)}
                        className="bg-[#283339] text-white border-transparent"
                        placeholder="e.g. 100"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Occupied Lots</label>
                    <Input
                        type="number"
                        value={inputs.occupied_lots}
                        onChange={(e) => handleChange('occupied_lots', e.target.value)}
                        className={`bg-[#283339] text-white border-transparent ${error ? 'border-red-500 focus:ring-red-500' : ''}`}
                        placeholder="e.g. 85"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Current Lot Rent (Monthly)</label>
                    <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-400">$</span>
                        <Input
                            type="number"
                            value={inputs.current_lot_rent}
                            onChange={(e) => handleChange('current_lot_rent', e.target.value)}
                            className="bg-[#283339] text-white border-transparent pl-8"
                            placeholder="e.g. 500"
                        />
                    </div>
                </div>
            </div>

            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-500 text-sm">
                    {error}
                </div>
            )}
        </div>
    );
};

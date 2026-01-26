"use client";

import React, { useEffect, useState } from 'react';
import { Input } from "@/components/ui/Input";
import { DiscrepancyLabel } from "@/components/ui/DiscrepancyLabel";

interface Step2Props {
    onDataChange: (data: any) => void;
    initialData?: any;
}

export const Step2RentRoll: React.FC<Step2Props> = ({ onDataChange, initialData }) => {
    const pdfValues = initialData?.pdf_values || {};
    const [inputs, setInputs] = useState({
        total_lots: initialData?.total_lots || '',
        occupied_lots: initialData?.occupied_lots || '',
        current_lot_rent: initialData?.current_lot_rent || '',
        base_capx: initialData?.base_capx || '',
        capx_mgmt_fees: initialData?.capx_mgmt_fees || '',
        absorption_lease_up_period: initialData?.absorption_lease_up_period || '',
        terminal_occupancy: initialData?.terminal_occupancy || '',
        rent_bump_y1: initialData?.rent_bump_y1 || '',
        rent_bump_y2_5: initialData?.rent_bump_y2_5 || '',
        loss_to_lease: initialData?.loss_to_lease || '',
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
            base_capx: initialData?.base_capx || '',
            capx_mgmt_fees: initialData?.capx_mgmt_fees || '',
            absorption_lease_up_period: initialData?.absorption_lease_up_period || '',
            terminal_occupancy: initialData?.terminal_occupancy || '',
            rent_bump_y1: initialData?.rent_bump_y1 || '',
            rent_bump_y2_5: initialData?.rent_bump_y2_5 || '',
            loss_to_lease: initialData?.loss_to_lease || '',
        };
        const hasChanges =
            next.total_lots !== inputs.total_lots ||
            next.occupied_lots !== inputs.occupied_lots ||
            next.current_lot_rent !== inputs.current_lot_rent ||
            next.base_capx !== inputs.base_capx ||
            next.capx_mgmt_fees !== inputs.capx_mgmt_fees ||
            next.absorption_lease_up_period !== inputs.absorption_lease_up_period ||
            next.terminal_occupancy !== inputs.terminal_occupancy ||
            next.rent_bump_y1 !== inputs.rent_bump_y1 ||
            next.rent_bump_y2_5 !== inputs.rent_bump_y2_5 ||
            next.loss_to_lease !== inputs.loss_to_lease;

        if (hasChanges) {
            setInputs(next);
        }
    }, [
        initialData?.total_lots,
        initialData?.occupied_lots,
        initialData?.current_lot_rent,
        initialData?.base_capx,
        initialData?.capx_mgmt_fees,
        initialData?.absorption_lease_up_period,
        initialData?.terminal_occupancy,
        initialData?.rent_bump_y1,
        initialData?.rent_bump_y2_5,
        initialData?.loss_to_lease,
    ]);

    const handleChange = (field: string, value: string) => {
        setInputs(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Rent Roll</h2>
                <p className="text-sm text-slate-500 dark:text-gray-400">Enter the current occupancy and rent details.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <DiscrepancyLabel
                        label="Total MH Lots"
                        fieldKey="total_lots"
                        currentValue={inputs.total_lots}
                        pdfValues={pdfValues}
                    />
                    <Input
                        type="number"
                        value={inputs.total_lots}
                        onChange={(e) => handleChange('total_lots', e.target.value)}
                        className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                        placeholder="e.g. 100"
                    />
                </div>

                <div>
                    <DiscrepancyLabel
                        label="Occupied MH Lots"
                        fieldKey="occupied_lots"
                        currentValue={inputs.occupied_lots}
                        pdfValues={pdfValues}
                    />
                    <Input
                        type="number"
                        value={inputs.occupied_lots}
                        onChange={(e) => handleChange('occupied_lots', e.target.value)}
                        className={`bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent ${error ? 'border-red-500 focus:ring-red-500' : ''}`}
                        placeholder="e.g. 85"
                    />
                </div>

                <div>
                    <DiscrepancyLabel
                        label="Avg Lot Rent (Monthly)"
                        fieldKey="current_lot_rent"
                        currentValue={inputs.current_lot_rent}
                        pdfValues={pdfValues}
                    />
                    <div className="relative">
                        <span className="absolute left-3 top-2 text-slate-400">$</span>
                        <Input
                            type="number"
                            value={inputs.current_lot_rent}
                            onChange={(e) => handleChange('current_lot_rent', e.target.value)}
                            className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pl-8"
                            placeholder="e.g. 500"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <DiscrepancyLabel
                        label="Base CapX"
                        fieldKey="base_capx"
                        currentValue={inputs.base_capx}
                        pdfValues={pdfValues}
                    />
                    <div className="relative">
                        <span className="absolute left-3 top-2 text-slate-400">$</span>
                        <Input
                            type="number"
                            value={inputs.base_capx}
                            onChange={(e) => handleChange('base_capx', e.target.value)}
                            className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pl-8"
                            placeholder="e.g. 2000"
                        />
                    </div>
                </div>
                <div>
                    <DiscrepancyLabel
                        label="CapX Mgmt Fees (%)"
                        fieldKey="capx_mgmt_fees"
                        currentValue={inputs.capx_mgmt_fees}
                        pdfValues={pdfValues}
                    />
                    <Input
                        value={inputs.capx_mgmt_fees}
                        onChange={(e) => handleChange('capx_mgmt_fees', e.target.value)}
                        className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                        placeholder="e.g. 10"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="Absorption Lease Up Period (Months)"
                        fieldKey="absorption_lease_up_period"
                        currentValue={inputs.absorption_lease_up_period}
                        pdfValues={pdfValues}
                    />
                    <Input
                        value={inputs.absorption_lease_up_period}
                        onChange={(e) => handleChange('absorption_lease_up_period', e.target.value)}
                        className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                        placeholder="e.g. 1"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="Terminal Occupancy (%)"
                        fieldKey="terminal_occupancy"
                        currentValue={inputs.terminal_occupancy}
                        pdfValues={pdfValues}
                    />
                    <Input
                        value={inputs.terminal_occupancy}
                        onChange={(e) => handleChange('terminal_occupancy', e.target.value)}
                        className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent"
                        placeholder="e.g. 95"
                    />
                </div>
                <div>
                    <DiscrepancyLabel
                        label="Rent Bump Y1"
                        fieldKey="rent_bump_y1"
                        currentValue={inputs.rent_bump_y1}
                        pdfValues={pdfValues}
                    />
                    <div className="relative">
                        <span className="absolute left-3 top-2 text-slate-400">$</span>
                        <Input
                            type="number"
                            value={inputs.rent_bump_y1}
                            onChange={(e) => handleChange('rent_bump_y1', e.target.value)}
                            className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pl-8"
                            placeholder="e.g. 208"
                        />
                    </div>
                </div>
                <div>
                    <DiscrepancyLabel
                        label="Rent Bump Y2-Y5"
                        fieldKey="rent_bump_y2_5"
                        currentValue={inputs.rent_bump_y2_5}
                        pdfValues={pdfValues}
                    />
                    <div className="relative">
                        <span className="absolute left-3 top-2 text-slate-400">$</span>
                        <Input
                            type="number"
                            value={inputs.rent_bump_y2_5}
                            onChange={(e) => handleChange('rent_bump_y2_5', e.target.value)}
                            className="bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent pl-8"
                            placeholder="e.g. 100"
                        />
                    </div>
                </div>
                <div>
                    <DiscrepancyLabel
                        label="Loss to Lease"
                        fieldKey="loss_to_lease"
                        currentValue={inputs.loss_to_lease}
                        pdfValues={pdfValues}
                    />
                    <select
                        value={inputs.loss_to_lease}
                        onChange={(e) => handleChange('loss_to_lease', e.target.value)}
                        className="w-full rounded-md bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent px-3 py-2"
                    >
                        <option value="">Select</option>
                        <option value="YES">Yes</option>
                        <option value="NO">No</option>
                    </select>
                </div>
            </div>

            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-600 dark:text-red-500 text-sm">
                    {error}
                </div>
            )}
        </div>
    );
};

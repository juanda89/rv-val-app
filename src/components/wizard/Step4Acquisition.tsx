"use client";

import React, { useEffect, useState } from 'react';
import { Input } from "@/components/ui/Input";
import { DiscrepancyLabel } from "@/components/ui/DiscrepancyLabel";

interface Step4Props {
    onDataChange: (data: any) => void;
    initialData?: any;
}

export const Step4Acquisition: React.FC<Step4Props> = ({ onDataChange, initialData }) => {
    const pdfValues = initialData?.pdf_values || {};
    const normalizePercentInput = (value: any) => {
        if (value === null || value === undefined || value === '') return '';
        return String(value).replace('%', '').trim();
    };
    const normalizeYesNo = (value: any) => {
        if (value === null || value === undefined || value === '') return '';
        const normalized = String(value).trim().toUpperCase();
        if (normalized === 'Y') return 'YES';
        if (normalized === 'N') return 'NO';
        return normalized;
    };
    const toTitleYesNo = (value: any) => {
        const normalized = normalizeYesNo(value);
        if (normalized === 'YES') return 'Yes';
        if (normalized === 'NO') return 'No';
        return value ?? '';
    };
    const toPercentForSync = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return '';
        return trimmed.endsWith('%') ? trimmed : `${trimmed}%`;
    };
    const [inputs, setInputs] = useState({
        appraisal: initialData?.appraisal ?? '',
        ppa: initialData?.ppa ?? '',
        pca: initialData?.pca ?? '',
        esa_phase_1: initialData?.esa_phase_1 ?? '',
        pza: initialData?.pza ?? '',
        survey: initialData?.survey ?? '',
        camera_sewer_electrical_inspection: initialData?.camera_sewer_electrical_inspection ?? '',
        water_leak_detection: initialData?.water_leak_detection ?? '',
        buyer_legal: initialData?.buyer_legal ?? '',
        lender_legal: initialData?.lender_legal ?? '',
        title_and_closing: initialData?.title_and_closing ?? '',
        loan_origination: initialData?.loan_origination ?? '',
        travel: initialData?.travel ?? '',
        contingency: initialData?.contingency ?? '',
        rate_buy_down: initialData?.rate_buy_down ?? '',
        buyer_paid_broker_commission: initialData?.buyer_paid_broker_commission ?? '',
        acquisition_fee: initialData?.acquisition_fee ?? '',
        cost_of_sale: initialData?.cost_of_sale ?? '',
        credit_loss: initialData?.credit_loss ?? '',
        annual_inflation: initialData?.annual_inflation ?? '',
        management_fee: initialData?.management_fee ?? '',
        monthly_min_management_fee: initialData?.monthly_min_management_fee ?? '',
        full_whammy_tax_bump: toTitleYesNo(initialData?.full_whammy_tax_bump),
        year_1_tax_increase: normalizePercentInput(initialData?.year_1_tax_increase),
        property_manager_salary: initialData?.property_manager_salary ?? '',
        assistant_property_manager_salary: initialData?.assistant_property_manager_salary ?? '',
        maintenance_man_salary: initialData?.maintenance_man_salary ?? '',
        number_of_pms: initialData?.number_of_pms ?? '',
        number_of_apms: initialData?.number_of_apms ?? '',
        number_of_mms: initialData?.number_of_mms ?? '',
        rm_per_lot: initialData?.rm_per_lot ?? '',
    });

    useEffect(() => {
        onDataChange({
            ...inputs,
            year_1_tax_increase: toPercentForSync(inputs.year_1_tax_increase),
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inputs]);

    useEffect(() => {
        setInputs({
            appraisal: initialData?.appraisal ?? '',
            ppa: initialData?.ppa ?? '',
            pca: initialData?.pca ?? '',
            esa_phase_1: initialData?.esa_phase_1 ?? '',
            pza: initialData?.pza ?? '',
            survey: initialData?.survey ?? '',
            camera_sewer_electrical_inspection: initialData?.camera_sewer_electrical_inspection ?? '',
            water_leak_detection: initialData?.water_leak_detection ?? '',
            buyer_legal: initialData?.buyer_legal ?? '',
            lender_legal: initialData?.lender_legal ?? '',
            title_and_closing: initialData?.title_and_closing ?? '',
            loan_origination: initialData?.loan_origination ?? '',
            travel: initialData?.travel ?? '',
            contingency: initialData?.contingency ?? '',
            rate_buy_down: initialData?.rate_buy_down ?? '',
            buyer_paid_broker_commission: initialData?.buyer_paid_broker_commission ?? '',
            acquisition_fee: initialData?.acquisition_fee ?? '',
            cost_of_sale: initialData?.cost_of_sale ?? '',
            credit_loss: initialData?.credit_loss ?? '',
            annual_inflation: initialData?.annual_inflation ?? '',
            management_fee: initialData?.management_fee ?? '',
            monthly_min_management_fee: initialData?.monthly_min_management_fee ?? '',
            full_whammy_tax_bump: toTitleYesNo(initialData?.full_whammy_tax_bump),
            year_1_tax_increase: normalizePercentInput(initialData?.year_1_tax_increase),
            property_manager_salary: initialData?.property_manager_salary ?? '',
            assistant_property_manager_salary: initialData?.assistant_property_manager_salary ?? '',
            maintenance_man_salary: initialData?.maintenance_man_salary ?? '',
            number_of_pms: initialData?.number_of_pms ?? '',
            number_of_apms: initialData?.number_of_apms ?? '',
            number_of_mms: initialData?.number_of_mms ?? '',
            rm_per_lot: initialData?.rm_per_lot ?? '',
        });
    }, [
        initialData?.appraisal,
        initialData?.ppa,
        initialData?.pca,
        initialData?.esa_phase_1,
        initialData?.pza,
        initialData?.survey,
        initialData?.camera_sewer_electrical_inspection,
        initialData?.water_leak_detection,
        initialData?.buyer_legal,
        initialData?.lender_legal,
        initialData?.title_and_closing,
        initialData?.loan_origination,
        initialData?.travel,
        initialData?.contingency,
        initialData?.rate_buy_down,
        initialData?.buyer_paid_broker_commission,
        initialData?.acquisition_fee,
        initialData?.cost_of_sale,
        initialData?.credit_loss,
        initialData?.annual_inflation,
        initialData?.management_fee,
        initialData?.monthly_min_management_fee,
        initialData?.full_whammy_tax_bump,
        initialData?.year_1_tax_increase,
        initialData?.property_manager_salary,
        initialData?.assistant_property_manager_salary,
        initialData?.maintenance_man_salary,
        initialData?.number_of_pms,
        initialData?.number_of_apms,
        initialData?.number_of_mms,
        initialData?.rm_per_lot,
    ]);

    const handleChange = (field: string, value: string) => {
        setInputs((prev) => ({ ...prev, [field]: value }));
    };

    const whammyValue = normalizeYesNo(inputs.full_whammy_tax_bump);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Acquisition & Operations</h2>
                <p className="text-sm text-slate-500 dark:text-gray-400">
                    Enter acquisition costs and operating assumptions.
                </p>
            </div>

            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Acquisition Costs</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField label="Appraisal" value={inputs.appraisal} onChange={handleChange} field="appraisal" pdfValues={pdfValues} />
                    <InputField label="PPA" value={inputs.ppa} onChange={handleChange} field="ppa" pdfValues={pdfValues} />
                    <InputField label="PCA" value={inputs.pca} onChange={handleChange} field="pca" pdfValues={pdfValues} />
                    <InputField label="ESA Phase 1" value={inputs.esa_phase_1} onChange={handleChange} field="esa_phase_1" pdfValues={pdfValues} />
                    <InputField label="PZA" value={inputs.pza} onChange={handleChange} field="pza" pdfValues={pdfValues} />
                    <InputField label="Survey" value={inputs.survey} onChange={handleChange} field="survey" pdfValues={pdfValues} />
                    <InputField label="Camera Sewer & Electrical Inspection" value={inputs.camera_sewer_electrical_inspection} onChange={handleChange} field="camera_sewer_electrical_inspection" pdfValues={pdfValues} />
                    <InputField label="Water Leak Detection" value={inputs.water_leak_detection} onChange={handleChange} field="water_leak_detection" pdfValues={pdfValues} />
                    <InputField label="Buyer Legal" value={inputs.buyer_legal} onChange={handleChange} field="buyer_legal" pdfValues={pdfValues} />
                    <InputField label="Lender Legal" value={inputs.lender_legal} onChange={handleChange} field="lender_legal" pdfValues={pdfValues} />
                    <InputField label="Title & Closing" value={inputs.title_and_closing} onChange={handleChange} field="title_and_closing" pdfValues={pdfValues} />
                    <InputField label="Loan Origination" value={inputs.loan_origination} onChange={handleChange} field="loan_origination" pdfValues={pdfValues} />
                    <InputField label="Travel" value={inputs.travel} onChange={handleChange} field="travel" pdfValues={pdfValues} />
                    <InputField label="Contingency" value={inputs.contingency} onChange={handleChange} field="contingency" pdfValues={pdfValues} />
                    <InputField label="Rate Buy Down" value={inputs.rate_buy_down} onChange={handleChange} field="rate_buy_down" pdfValues={pdfValues} />
                    <InputField label="Buyer Paid Broker Commission" value={inputs.buyer_paid_broker_commission} onChange={handleChange} field="buyer_paid_broker_commission" pdfValues={pdfValues} />
                    <InputField label="Acquisition Fee" value={inputs.acquisition_fee} onChange={handleChange} field="acquisition_fee" pdfValues={pdfValues} />
                    <InputField label="Cost of Sale (%)" value={inputs.cost_of_sale} onChange={handleChange} field="cost_of_sale" pdfValues={pdfValues} />
                </div>
            </div>

            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Operating Assumptions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField label="Credit Loss" value={inputs.credit_loss} onChange={handleChange} field="credit_loss" pdfValues={pdfValues} />
                    <InputField label="Annual Inflation" value={inputs.annual_inflation} onChange={handleChange} field="annual_inflation" pdfValues={pdfValues} />
                    <InputField label="Management Fee" value={inputs.management_fee} onChange={handleChange} field="management_fee" pdfValues={pdfValues} />
                    <InputField label="Monthly Minimum Management Fee" value={inputs.monthly_min_management_fee} onChange={handleChange} field="monthly_min_management_fee" pdfValues={pdfValues} />
                    <div>
                        <DiscrepancyLabel
                            label="Full Whammy Tax Bump?"
                            fieldKey="full_whammy_tax_bump"
                            currentValue={inputs.full_whammy_tax_bump}
                            pdfValues={pdfValues}
                        />
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => handleChange('full_whammy_tax_bump', 'Yes')}
                                className={`px-4 py-2 rounded-md border text-sm font-semibold transition ${
                                    whammyValue === 'YES'
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white dark:bg-[#283339] text-slate-700 dark:text-slate-200 border-slate-300 dark:border-transparent'
                                }`}
                                aria-pressed={whammyValue === 'YES'}
                            >
                                Yes
                            </button>
                            <button
                                type="button"
                                onClick={() => handleChange('full_whammy_tax_bump', 'No')}
                                className={`px-4 py-2 rounded-md border text-sm font-semibold transition ${
                                    whammyValue === 'NO'
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white dark:bg-[#283339] text-slate-700 dark:text-slate-200 border-slate-300 dark:border-transparent'
                                }`}
                                aria-pressed={whammyValue === 'NO'}
                            >
                                No
                            </button>
                        </div>
                    </div>
                    {whammyValue === 'NO' && (
                        <InputField
                            label="Year 1 Tax Increase"
                            value={inputs.year_1_tax_increase}
                            onChange={handleChange}
                            field="year_1_tax_increase"
                            pdfValues={pdfValues}
                            isPercent
                        />
                    )}
                </div>
            </div>

            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Payroll & Maintenance</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField label="Property Manager Salary" value={inputs.property_manager_salary} onChange={handleChange} field="property_manager_salary" pdfValues={pdfValues} />
                    <InputField label="Assistant Property Manager Salary" value={inputs.assistant_property_manager_salary} onChange={handleChange} field="assistant_property_manager_salary" pdfValues={pdfValues} />
                    <InputField label="Maintenance Man Salary" value={inputs.maintenance_man_salary} onChange={handleChange} field="maintenance_man_salary" pdfValues={pdfValues} />
                    <InputField label="# of PMs" value={inputs.number_of_pms} onChange={handleChange} field="number_of_pms" pdfValues={pdfValues} />
                    <InputField label="# of APMs" value={inputs.number_of_apms} onChange={handleChange} field="number_of_apms" pdfValues={pdfValues} />
                    <InputField label="# of MMs" value={inputs.number_of_mms} onChange={handleChange} field="number_of_mms" pdfValues={pdfValues} />
                    <InputField label="R&M per Lot" value={inputs.rm_per_lot} onChange={handleChange} field="rm_per_lot" pdfValues={pdfValues} />
                </div>
            </div>

        </div>
    );
};

const InputField = ({
    label,
    value,
    onChange,
    field,
    pdfValues,
    isPercent = false,
}: {
    label: string;
    value: string;
    onChange: (field: string, value: string) => void;
    field: string;
    pdfValues?: Record<string, any>;
    isPercent?: boolean;
}) => (
    <div>
        <DiscrepancyLabel
            label={label}
            fieldKey={field}
            currentValue={value}
            pdfValues={pdfValues}
        />
        <div className="relative">
            <Input
                value={value}
                onChange={(e) => {
                    const nextValue = isPercent
                        ? e.target.value.replace('%', '').trim()
                        : e.target.value;
                    onChange(field, nextValue);
                }}
                className={`bg-white dark:bg-[#283339] text-slate-900 dark:text-white border border-slate-300 dark:border-transparent ${isPercent ? 'pr-8' : ''}`}
            />
            {isPercent && (
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500 dark:text-slate-400 text-sm">
                    %
                </span>
            )}
        </div>
    </div>
);

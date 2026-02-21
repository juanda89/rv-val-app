"use client";

import React, { useMemo, useRef, useState } from 'react';
import { Step1Location } from './Step1Location';
import { Step2RentRoll } from './Step2RentRoll';
import { Step3PnL } from './Step3PnL';
import { Step4Acquisition } from './Step4Acquisition';
import { Step4Taxes } from './Step4Taxes';
import { Button } from "@/components/ui/Button";
import { useSheetSync } from '@/hooks/useSheetSync';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ValuationUploadPanel } from '@/components/wizard/ValuationUploadPanel';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { BarChart3 } from 'lucide-react';
import { PNL_LABELS } from '@/config/pnlMapping';
import { SHEET_MAPPING } from '@/config/sheetMapping';
import type { ApiProvider } from '@/types/apiProvider';

const STEPS = [
    { id: 1, title: 'Property Basics', icon: 'domain' },
    { id: 2, title: 'Rent Roll', icon: 'list_alt' },
    { id: 3, title: 'P&L Upload', icon: 'upload_file' },
    { id: 4, title: 'Acquisition', icon: 'assignment' },
    { id: 5, title: 'Taxes', icon: 'account_balance' },
    { id: 6, title: 'Results', icon: 'analytics' },
];

export const WizardLayout = ({
    user,
    initialProjectId,
    initialData
}: {
    user?: any;
    initialProjectId?: string | null;
    initialData?: any;
}) => {
    const router = useRouter();
    // 1. All hooks must run first
    const [mounted, setMounted] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState<any>(initialData || {});
    const [selectedApi, setSelectedApi] = useState<ApiProvider | null>('melissa');
    const [outputs, setOutputs] = useState<any>(null); // Store sync results
    const [projectId, setProjectId] = useState<string | null>(initialProjectId || null);
    const [creatingProject, setCreatingProject] = useState(false);
    const [nextSyncing, setNextSyncing] = useState(false);
    const [busyStates, setBusyStates] = useState<Record<string, boolean>>({});
    const setBusyState = React.useCallback((key: string, value: boolean) => {
        setBusyStates((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
    }, []);
    const isExternalBusy = useMemo(() => Object.values(busyStates).some(Boolean), [busyStates]);
    const handleUploadBusy = React.useCallback((busy: boolean) => setBusyState('upload', busy), [setBusyState]);
    const handleAttomBusy = React.useCallback((busy: boolean) => setBusyState('attom', busy), [setBusyState]);
    const handlePnlBusy = React.useCallback((busy: boolean) => setBusyState('pnl', busy), [setBusyState]);
    const handleTaxesBusy = React.useCallback((busy: boolean) => setBusyState('taxes', busy), [setBusyState]);
    const [refreshingOutputs, setRefreshingOutputs] = useState(false);
    const { sync, isSyncing } = useSheetSync(projectId || '');
    const pendingSyncRef = useRef<Record<string, any>>({});
    const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const syncInFlightRef = useRef(false);
    const nonSheetKeys = useRef(
        new Set([
            'pdf_values',
            'api_values',
            'default_values',
            'demographics_details',
            'outputs',
            'pnl_income_items',
            'pnl_expense_items',
            'pnl_grouped_income',
            'pnl_grouped_expenses',
            'pnl_income_assignments',
            'pnl_expense_assignments',
            'attom_initial_autofill_done',
        ])
    ).current;
    const isEmptyValue = (value: any) =>
        value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
    const createItemId = () => {
        if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
            return crypto.randomUUID();
        }
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    };
    const normalizeName = (value: string) => value.trim().toLowerCase();
    const normalizeComparable = (value: any) =>
        String(value ?? '')
            .toLowerCase()
            .replace(/[\s-]+/g, '')
            .trim();
    const parseAmount = (value: unknown) => {
        if (value === null || value === undefined || value === '') return null;
        if (typeof value === 'number') return Number.isFinite(value) ? value : null;
        const cleaned = String(value).replace(/[$,]/g, '').trim();
        const parsed = Number(cleaned);
        return Number.isFinite(parsed) ? parsed : null;
    };
    const getPnlLabel = (key: string) => {
        if (PNL_LABELS[key]) return PNL_LABELS[key];
        const stripped = key.replace(/^revenue_/, '').replace(/^expense_/, '').replace(/_/g, ' ');
        return stripped
            .split(' ')
            .filter(Boolean)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const getPnlItems = (primaryKey: string, fallbackKey?: string) => {
        if (Array.isArray(formData?.[primaryKey])) return formData[primaryKey];
        if (fallbackKey && Array.isArray(formData?.[fallbackKey])) return formData[fallbackKey];
        return [];
    };

    const sumPnlItems = (items: any[], valueKey: string) =>
        items.reduce((sum, item) => sum + (parseAmount(item?.[valueKey]) ?? 0), 0);

    const pnlIncomeItems = getPnlItems('pnl_income_items', 'income_items');
    const pnlExpenseItems = getPnlItems('pnl_expense_items', 'expense_items');
    const pnlGroupedIncome = getPnlItems('pnl_grouped_income');
    const pnlGroupedExpenses = getPnlItems('pnl_grouped_expenses');

    const pnlTotals = {
        income: sumPnlItems(pnlIncomeItems, 'amount'),
        expenses: sumPnlItems(pnlExpenseItems, 'amount'),
        groupedIncome: sumPnlItems(pnlGroupedIncome, 'total'),
        groupedExpenses: sumPnlItems(pnlGroupedExpenses, 'total'),
    };

    const pnlHasGrouped = pnlGroupedIncome.length > 0 || pnlGroupedExpenses.length > 0;
    const pnlTotalsMatch =
        pnlHasGrouped &&
        Math.abs(pnlTotals.income - pnlTotals.groupedIncome) < 0.01 &&
        Math.abs(pnlTotals.expenses - pnlTotals.groupedExpenses) < 0.01;
    const pnlGateBlocked = !pnlTotalsMatch;

    // 2. Effects
    React.useEffect(() => {
        setMounted(true);
    }, []);

    React.useEffect(() => {
        if (initialProjectId) setProjectId(initialProjectId);
    }, [initialProjectId]);

    React.useEffect(() => {
        if (initialData) {
            const { outputs: initialOutputs, ...rest } = initialData;
            setFormData((prev: any) => ({ ...prev, ...rest }));
            if (initialOutputs) {
                setOutputs(initialOutputs);
            }
        }
    }, [initialData]);

    // 3. Conditional Rendering (after all hooks)
    // if (!mounted) return null; // Prevent hydration mismatch -- REMOVED to avoid hook mismatch in Next 15/React 18 stricter dev mode

    // Instead, we just handle loading states in children or effects if needed, but for "use client" it's usually fine.
    // However, to fix "Rendered more hooks", we CANNOT return null *before* using hooks.
    // The previous error was because useSheetSync was called *after* a potential early return if we weren't careful, 
    // OR if useSheetSync itself conditionally calls hooks (it doesn't seem to).

    // The REAL issue from the log:
    // 9. useCallback
    // 10. useEffect
    // 11. undefined vs useCallback

    // This implies a hook is being called conditionally or loops are changing.
    // `useSheetSync` is called at the top level? Yes.

    // Let's remove the hydration check or move it to the very end before returning JSX.
    // And ensure hooks are ALWAYS called.

    // Cleaned up handleDataChange
    const pickMappedInputs = React.useCallback((data: Record<string, any>) => {
        const mapped: Record<string, any> = {};
        Object.entries(data).forEach(([key, value]) => {
            if (nonSheetKeys.has(key)) return;
            if (value === undefined) return;
            if (typeof value === 'function') return;
            if (value !== null && typeof value === 'object') return;
            mapped[key] = value;
        });
        return mapped;
    }, [nonSheetKeys]);

    const flushPendingSync = React.useCallback(async (payload?: Record<string, any>) => {
        if (!projectId) return;
        const nextPayload = payload || pendingSyncRef.current;
        if (!nextPayload || Object.keys(nextPayload).length === 0) return;

        pendingSyncRef.current = {};
        if (syncTimerRef.current) {
            clearTimeout(syncTimerRef.current);
            syncTimerRef.current = null;
        }

        if (syncInFlightRef.current) {
            pendingSyncRef.current = { ...nextPayload, ...pendingSyncRef.current };
            return;
        }

        syncInFlightRef.current = true;
        try {
            const results = await sync(nextPayload);
            if (results) {
                setOutputs((prev: any) => ({ ...prev, ...results }));
            }
        } finally {
            syncInFlightRef.current = false;
            if (Object.keys(pendingSyncRef.current).length > 0) {
                await flushPendingSync();
            }
        }
    }, [projectId, sync]);

    const queueSync = React.useCallback((payload: Record<string, any>) => {
        if (!projectId || Object.keys(payload).length === 0) return;
        pendingSyncRef.current = { ...pendingSyncRef.current, ...payload };
        if (syncTimerRef.current) {
            clearTimeout(syncTimerRef.current);
        }
        syncTimerRef.current = setTimeout(() => {
            void flushPendingSync();
        }, 600);
    }, [projectId, flushPendingSync]);

    const handleDataChange = React.useCallback(async (stepData: any) => {
        setFormData((prev: any) => ({ ...prev, ...stepData }));

        if (projectId) {
            const mapped = pickMappedInputs(stepData);
            if (Object.keys(mapped).length > 0) {
                queueSync(mapped);
            }
        }
    }, [projectId, pickMappedInputs, queueSync]);

    const syncPnlPlanB = React.useCallback(async () => {
        if (!projectId) return;

        const incomeItems = Array.isArray(formData?.pnl_income_items) ? formData.pnl_income_items : [];
        const expenseItems = Array.isArray(formData?.pnl_expense_items) ? formData.pnl_expense_items : [];
        const groupedIncome = Array.isArray(formData?.pnl_grouped_income) ? formData.pnl_grouped_income : [];
        const groupedExpenses = Array.isArray(formData?.pnl_grouped_expenses) ? formData.pnl_grouped_expenses : [];

        const hasOriginals = incomeItems.length > 0 || expenseItems.length > 0;
        const hasGrouped = groupedIncome.length > 0 || groupedExpenses.length > 0;

        if (!hasOriginals && !hasGrouped) return;

        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (hasOriginals) {
            await fetch('/api/pnl/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({
                    projectId,
                    incomeItems,
                    expenseItems
                })
            });
        }

        if (hasGrouped) {
            await fetch('/api/pnl/grouped/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({
                    projectId,
                    groupedIncome,
                    groupedExpenses
                })
            });
        }
    }, [formData, projectId]);

    const buildStepPayload = React.useCallback((step: number) => {
        const mapping: Record<number, string[]> = {
            1: [
                'name',
                'mobile_home_park_name',
                'owner_name',
                'city',
                'state',
                'county',
                'zip_code',
                'address',
                'mobile_home_park_address',
                'parcelNumber',
                'parcel_1',
                'population_1mile',
                'median_income',
                'acreage',
                'parcel_1_acreage',
                'year_built',
                'property_type',
                'last_sale_price',
                'population',
                'population_change',
                'poverty_rate',
                'median_household_income',
                'median_household_income_change',
                'number_of_employees',
                'number_of_employees_change',
                'median_property_value',
                'median_property_value_change',
                'violent_crime',
                'property_crime',
                'two_br_rent',
                'eli_renter_households',
                'units_per_100',
                'total_units',
            ],
            2: [
                'total_lots',
                'occupied_lots',
                'current_lot_rent',
                'base_capx',
                'capx_mgmt_fees',
                'absorption_lease_up_period',
                'terminal_occupancy',
                'rent_bump_y1',
                'rent_bump_y2_5',
                'loss_to_lease',
            ],
            4: [
                'appraisal',
                'ppa',
                'pca',
                'esa_phase_1',
                'pza',
                'survey',
                'camera_sewer_electrical_inspection',
                'water_leak_detection',
                'buyer_legal',
                'lender_legal',
                'title_and_closing',
                'loan_origination',
                'travel',
                'contingency',
                'rate_buy_down',
                'buyer_paid_broker_commission',
                'acquisition_fee',
                'cost_of_sale',
                'credit_loss',
                'annual_inflation',
                'management_fee',
                'monthly_min_management_fee',
                'full_whammy_tax_bump',
                'year_1_tax_increase',
                'property_manager_salary',
                'assistant_property_manager_salary',
                'maintenance_man_salary',
                'number_of_pms',
                'number_of_apms',
                'number_of_mms',
                'rm_per_lot',
            ],
            5: [
                'tax_assessed_value',
                'tax_year',
                'tax_assessment_rate',
                'tax_millage_rate',
                'tax_prev_year_amount',
                'fair_market_value',
                'assessed_value',
                'previous_year_re_taxes',
                'us_10_year_treasury',
                'spread',
                'spread_escalation_allowance',
                'dscr',
                'max_ltc',
                'loan_term',
                'interest_only_time_period',
                'cap_rate_decompression',
                'real_estate_valuation',
                'preferred_return',
                'lp_split',
                'gp_split',
                'hold_period',
            ],
        };

        const keys = mapping[step] || [];
        const payload: Record<string, any> = {};
        keys.forEach((key) => {
            if (formData?.[key] !== undefined) {
                payload[key] = formData[key];
            }
        });
        return payload;
    }, [formData]);

    const handleAutofill = React.useCallback(async (extracted: Record<string, any>) => {
        if (!extracted || Object.keys(extracted).length === 0) return;

        const updates: Record<string, any> = {};
        const pdfValues: Record<string, any> = {};
        const incomeFromUpload: Array<{ id: string; name: string; amount: number }> = [];
        const expenseFromUpload: Array<{ id: string; name: string; amount: number }> = [];
        const skipAutoFields = new Set([
            'city',
            'state',
            'county',
            'zip_code',
            'parcel_1',
            'parcelNumber',
            'parcel_1_acreage',
            'acreage',
            'property_type',
            'year_built',
            'last_sale_price',
            'lat',
            'lng',
        ]);
        Object.entries(extracted).forEach(([key, value]) => {
            if (key.startsWith('revenue_')) {
                const amount = parseAmount(value);
                if (amount !== null) {
                    incomeFromUpload.push({ id: createItemId(), name: getPnlLabel(key), amount });
                }
                return;
            }
            if (key.startsWith('expense_')) {
                const amount = parseAmount(value);
                if (amount !== null) {
                    expenseFromUpload.push({ id: createItemId(), name: getPnlLabel(key), amount });
                }
                return;
            }
            pdfValues[key] = value;
            if (!skipAutoFields.has(key)) {
                updates[key] = value;
            }
        });
        if (pdfValues.parcelNumber && !pdfValues.parcel_1) {
            pdfValues.parcel_1 = pdfValues.parcelNumber;
        }
        if (pdfValues.parcel_1 && !pdfValues.parcelNumber) {
            pdfValues.parcelNumber = pdfValues.parcel_1;
        }
        if (pdfValues.acreage && !pdfValues.parcel_1_acreage) {
            pdfValues.parcel_1_acreage = pdfValues.acreage;
        }
        if (pdfValues.address && !pdfValues.mobile_home_park_address) {
            pdfValues.mobile_home_park_address = pdfValues.address;
        }
        if (pdfValues.mobile_home_park_address && !pdfValues.address) {
            pdfValues.address = pdfValues.mobile_home_park_address;
        }
        if (pdfValues.name && !pdfValues.mobile_home_park_name) {
            pdfValues.mobile_home_park_name = pdfValues.name;
        }
        if (pdfValues.zip && !pdfValues.zip_code) {
            pdfValues.zip_code = pdfValues.zip;
        }

        setFormData((prev: any) => {
            const next = { ...prev };
            const defaultValues = prev?.default_values || {};
            const isDefaultValue = (key: string, currentValue: any) =>
                defaultValues[key] !== undefined &&
                defaultValues[key] !== null &&
                defaultValues[key] !== '' &&
                normalizeComparable(currentValue) === normalizeComparable(defaultValues[key]);
            Object.entries(updates).forEach(([key, value]) => {
                if (isEmptyValue(next[key]) || isDefaultValue(key, next[key])) {
                    next[key] = value;
                } else {
                    delete updates[key];
                }
            });
            if (Object.keys(pdfValues).length > 0) {
                next.pdf_values = { ...(prev?.pdf_values || {}), ...pdfValues };
            }

            if (incomeFromUpload.length > 0) {
                const existingIncome = Array.isArray(next.pnl_income_items)
                    ? next.pnl_income_items
                    : Array.isArray(next.income_items)
                        ? next.income_items
                        : [];
                const existingNames = new Set(
                    existingIncome
                        .map((item: any) => (typeof item?.name === 'string' ? normalizeName(item.name) : ''))
                        .filter(Boolean)
                );
                const newItems = incomeFromUpload.filter(
                    item => !existingNames.has(normalizeName(item.name))
                );
                if (newItems.length > 0) {
                    next.pnl_income_items = [...existingIncome, ...newItems];
                }
            }

            if (expenseFromUpload.length > 0) {
                const existingExpenses = Array.isArray(next.pnl_expense_items)
                    ? next.pnl_expense_items
                    : Array.isArray(next.expense_items)
                        ? next.expense_items
                        : [];
                const existingNames = new Set(
                    existingExpenses
                        .map((item: any) => (typeof item?.name === 'string' ? normalizeName(item.name) : ''))
                        .filter(Boolean)
                );
                const newItems = expenseFromUpload.filter(
                    item => !existingNames.has(normalizeName(item.name))
                );
                if (newItems.length > 0) {
                    next.pnl_expense_items = [...existingExpenses, ...newItems];
                }
            }

            return next;
        });

        if (projectId && Object.keys(updates).length > 0) {
            await sync({ ...updates });
        }
    }, [projectId, sync]);

    const refreshOutputs = React.useCallback(async () => {
        if (!projectId) return;
        setRefreshingOutputs(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const response = await fetch('/api/sheet/load', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ projectId }),
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload?.error || 'Failed to load outputs');
            }
            if (payload?.outputs) {
                setOutputs(payload.outputs);
            }
        } catch (error) {
            console.error('Output refresh failed:', error);
        } finally {
            setRefreshingOutputs(false);
        }
    }, [projectId]);

    React.useEffect(() => {
        if (currentStep === 6 && projectId) {
            void refreshOutputs();
        }
    }, [currentStep, projectId, refreshOutputs]);


    const handleStep1Complete = async (data: any) => {
        // Special handling for Step 1: Create Project if not exists
        if (!projectId) {
            setCreatingProject(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;

                const res = await fetch('/api/projects/create', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : ''
                    },
                    body: JSON.stringify({
                        name: data.name || data.address || 'New Project',
                        address: data.address,
                        user_id: user?.id
                    })
                });
                const json = await res.json();

                if (json.project?.id) {
                    const newProjectId = json.project.id as string;
                    setProjectId(newProjectId);
                    if (json.project?.spreadsheet_id) {
                        setFormData((prev: any) => ({ ...prev, spreadsheet_id: json.project.spreadsheet_id }));
                    }
                    // Sync the initial data
                    const results = await sync(data, newProjectId);
                    if (results) setOutputs(results);
                    try {
                        const loadResponse = await fetch('/api/sheet/load', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': token ? `Bearer ${token}` : ''
                            },
                            body: JSON.stringify({ projectId: newProjectId }),
                        });
                        const loadPayload = await loadResponse.json();
                        if (loadResponse.ok && loadPayload?.inputs) {
                            const inputs = loadPayload.inputs || {};
                            const defaultValues = inputs.default_values || {};
                            const mergedInputs = { ...defaultValues, ...inputs };
                            setFormData((prev: any) => {
                                const next = { ...prev, default_values: defaultValues };
                                Object.entries(mergedInputs).forEach(([key, value]) => {
                                    if (isEmptyValue(next[key])) {
                                        next[key] = value;
                                    }
                                });
                                return next;
                            });
                        }
                    } catch (loadError) {
                        console.warn('Failed to load defaults after project creation:', loadError);
                    }
                    setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
                } else if (json.error) {
                    console.error('Project creation error:', json.error);
                    alert(`Error creating project: ${json.error}`);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setCreatingProject(false);
            }
        }
        handleDataChange(data);
    };

    const nextStep = async () => {
        if (currentStep >= 3 && pnlGateBlocked) {
            return;
        }
        if (currentStep === 1 && !projectId) {
            await handleStep1Complete(formData);
            return;
        }
        if (projectId) {
            setNextSyncing(true);
            try {
                const payload = buildStepPayload(currentStep);
                if (Object.keys(payload).length > 0) {
                    await flushPendingSync(payload);
                }
                if (currentStep === 3) {
                    await syncPnlPlanB();
                }
                if (currentStep === 5) {
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token;
                    try {
                        const runRes = await fetch('/api/sheet/run-objective-search', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': token ? `Bearer ${token}` : '',
                            },
                            body: JSON.stringify({ projectId }),
                        });
                        const runJson = await runRes.json().catch(() => ({}));
                        if (!runRes.ok) {
                            console.warn('Objective search failed before results:', runJson?.error || runRes.statusText);
                        }
                    } catch (runError: any) {
                        console.warn('Objective search request failed before results:', runError?.message || runError);
                    }
                }
            } finally {
                setNextSyncing(false);
            }
        }
        setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
    };
    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

    if (!mounted) {
        return null;
    }

    return (
        <div className="flex min-h-screen bg-slate-50 dark:bg-[#111618] text-slate-900 dark:text-white transition-colors duration-200">
            {/* Sidebar */}
            <div className="w-64 border-r border-slate-200 dark:border-[#283339] hidden md:flex flex-col p-6 sticky top-0 h-screen bg-white dark:bg-[#111618]">
                <Link href="/valuations" className="flex items-center gap-2 mb-8 hover:opacity-90">
                    <BarChart3 className="w-6 h-6 text-[#13a4ec]" />
                    <h1 className="font-bold text-xl text-slate-900 dark:text-white">RV Valuations</h1>
                </Link>

                <nav className="space-y-2">
                    {STEPS.map(step => (
                        <button
                            key={step.id}
                            onClick={() => {
                                if (projectId && (step.id <= 3 || !pnlGateBlocked)) {
                                    setCurrentStep(step.id);
                                }
                            }} // Only allow nav if project created
                            disabled={!projectId && step.id > 1 || (pnlGateBlocked && step.id > 3)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${currentStep === step.id ? 'bg-slate-100 dark:bg-[#283339] border-l-4 border-[#13a4ec] text-slate-900 dark:text-white' : 'text-slate-500 dark:text-gray-400 hover:bg-slate-100/60 dark:hover:bg-white/5'}`}
                        >
                            <span className="material-symbols-outlined">{step.icon}</span>
                            <span className="text-sm font-medium">{step.title}</span>
                        </button>
                    ))}
                </nav>

                <div className="mt-auto pt-6 border-t border-slate-200 dark:border-[#283339]">
                    {projectId && (
                        <div className="text-xs text-slate-500 dark:text-gray-500">
                            Project ID: <span className="font-mono text-slate-400">{projectId.slice(0, 8)}...</span>
                            <div className="mt-2 flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></span>
                                {isSyncing ? 'Syncing...' : 'Synced'}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row">
                {currentStep !== 6 && (
                    <ValuationUploadPanel
                        onAutofill={handleAutofill}
                        onBusyChange={handleUploadBusy}
                        selectedApi={selectedApi}
                        onApiChange={setSelectedApi}
                    />
                )}

                {/* Main Content */}
                <div className="flex-1 flex flex-col">
                    <header className="h-16 border-b border-slate-200 dark:border-[#283339] flex items-center justify-between px-8 bg-white/90 dark:bg-[#111618]/95 backdrop-blur sticky top-0 z-10">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{STEPS[currentStep - 1].title}</h2>
                        <div className="flex items-center gap-4">
                            <ThemeToggle className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors" />
                            {currentStep === 1 && !projectId ? (
                                <Button variant="ghost" className="text-slate-500 dark:text-gray-400" onClick={() => router.push('/valuations')}>
                                    Cancel
                                </Button>
                            ) : (
                                <Button variant="ghost" className="text-slate-500 dark:text-gray-400" onClick={prevStep} disabled={currentStep === 1}>Back</Button>
                            )}
                            {currentStep < 6 && (
                                <Button
                                    onClick={nextStep}
                                    disabled={
                                        currentStep === STEPS.length ||
                                        (!projectId && currentStep === 1 && !formData.address) ||
                                        (pnlGateBlocked && currentStep >= 3) ||
                                        creatingProject ||
                                        nextSyncing ||
                                        isSyncing ||
                                        isExternalBusy
                                    }
                                >
                                    {creatingProject
                                        ? "Creating..."
                                        : nextSyncing || isSyncing
                                            ? "Syncing..."
                                            : isExternalBusy
                                                ? "Working..."
                                                : "Next"}
                                </Button>
                            )}
                        </div>
                    </header>

                    <main className="flex-1 p-8 max-w-4xl mx-auto w-full">
                        {currentStep === 1 && (
                            <Step1Location
                                onDataChange={handleDataChange}
                                initialData={formData}
                                onBusyChange={handleAttomBusy}
                                selectedApi={selectedApi}
                            />
                        )}
                        {currentStep === 2 && <Step2RentRoll onDataChange={handleDataChange} initialData={formData} />}
                        {currentStep === 3 && (
                            <Step3PnL
                                onDataChange={handleDataChange}
                                initialData={formData}
                                projectId={projectId}
                                onBusyChange={handlePnlBusy}
                            />
                        )}
                        {currentStep === 4 && <Step4Acquisition onDataChange={handleDataChange} initialData={formData} />}
                        {currentStep === 5 && (
                            <Step4Taxes
                                onDataChange={handleDataChange}
                                initialData={formData}
                                address={formData.address}
                                onBusyChange={handleTaxesBusy}
                                selectedApi={selectedApi}
                            />
                        )}
                        {currentStep === 6 && (
                            <Dashboard
                                outputs={outputs}
                                inputs={formData}
                                onInputChange={handleDataChange}
                                shareId={formData?.spreadsheet_id}
                                onRefreshOutputs={refreshOutputs}
                                refreshingOutputs={refreshingOutputs}
                            />
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
};

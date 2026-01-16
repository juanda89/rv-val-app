"use client";

import React, { useRef, useState } from 'react';
import { Step1Location } from './Step1Location';
import { Step2RentRoll } from './Step2RentRoll';
import { Step3PnL } from './Step3PnL';
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

const STEPS = [
    { id: 1, title: 'Property Basics', icon: 'domain' },
    { id: 2, title: 'Rent Roll', icon: 'list_alt' },
    { id: 3, title: 'P&L Upload', icon: 'upload_file' },
    { id: 4, title: 'Taxes', icon: 'account_balance' },
    { id: 5, title: 'Results', icon: 'analytics' },
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
    const [outputs, setOutputs] = useState<any>(null); // Store sync results
    const [projectId, setProjectId] = useState<string | null>(initialProjectId || null);
    const [creatingProject, setCreatingProject] = useState(false);
    const [nextSyncing, setNextSyncing] = useState(false);
    const { sync, isSyncing } = useSheetSync(projectId || '');
    const pendingSyncRef = useRef<Record<string, any>>({});
    const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const syncInFlightRef = useRef(false);
    const inputKeys = useRef(new Set(Object.keys(SHEET_MAPPING.inputs).filter(k => k !== 'sheetName'))).current;
    const isEmptyValue = (value: any) =>
        value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
    const createItemId = () => {
        if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
            return crypto.randomUUID();
        }
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    };
    const normalizeName = (value: string) => value.trim().toLowerCase();
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
            setFormData((prev: any) => ({ ...prev, ...initialData }));
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
            if (inputKeys.has(key)) {
                mapped[key] = value;
            }
        });
        return mapped;
    }, [inputKeys]);

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
                'city',
                'county',
                'address',
                'parcelNumber',
                'population_1mile',
                'median_income',
                'acreage',
                'year_built',
                'property_type',
                'last_sale_price',
            ],
            2: [
                'total_lots',
                'occupied_lots',
                'current_lot_rent',
            ],
            4: [
                'tax_assessed_value',
                'tax_year',
                'tax_assessment_rate',
                'tax_millage_rate',
                'tax_prev_year_amount',
            ],
            5: [
                'annual_rent_growth',
                'expense_inflation',
                'exit_cap_rate',
                'occupancy_target',
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
        const incomeFromUpload: Array<{ id: string; name: string; amount: number }> = [];
        const expenseFromUpload: Array<{ id: string; name: string; amount: number }> = [];
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
            updates[key] = value;
        });

        setFormData((prev: any) => {
            const next = { ...prev };
            Object.entries(updates).forEach(([key, value]) => {
                if (isEmptyValue(next[key])) {
                    next[key] = value;
                } else {
                    delete updates[key];
                }
            });

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
            await sync(updates);
        }
    }, [projectId, sync]);


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
                {currentStep !== 5 && <ValuationUploadPanel onAutofill={handleAutofill} />}

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
                            {currentStep < 5 && (
                                <Button
                                    onClick={nextStep}
                                    disabled={
                                        currentStep === STEPS.length ||
                                        (!projectId && currentStep === 1 && !formData.address) ||
                                        (pnlGateBlocked && currentStep >= 3) ||
                                        nextSyncing ||
                                        isSyncing
                                    }
                                >
                                    {creatingProject ? "Creating..." : nextSyncing || isSyncing ? "Syncing..." : "Next"}
                                </Button>
                            )}
                        </div>
                    </header>

                    <main className="flex-1 p-8 max-w-4xl mx-auto w-full">
                        {currentStep === 1 && <Step1Location onDataChange={handleDataChange} initialData={formData} />}
                        {currentStep === 2 && <Step2RentRoll onDataChange={handleDataChange} initialData={formData} />}
                    {currentStep === 3 && <Step3PnL onDataChange={handleDataChange} initialData={formData} projectId={projectId} />}
                        {currentStep === 4 && <Step4Taxes onDataChange={handleDataChange} initialData={formData} address={formData.address} />}
                        {currentStep === 5 && <Dashboard outputs={outputs} inputs={formData} onInputChange={handleDataChange} shareId={formData?.spreadsheet_id} />}
                    </main>
                </div>
            </div>
        </div>
    );
};

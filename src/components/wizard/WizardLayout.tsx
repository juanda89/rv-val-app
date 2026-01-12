"use client";

import React, { useState } from 'react';
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
    const { sync, isSyncing } = useSheetSync(projectId || '');
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
    const handleDataChange = React.useCallback(async (stepData: any) => {
        setFormData((prev: any) => ({ ...prev, ...stepData }));

        if (projectId) {
            await sync(stepData).then(results => {
                if (results) setOutputs((prev: any) => ({ ...prev, ...results }));
            });
        }
    }, [projectId, sync]);

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
        if (currentStep === 1 && !projectId) {
            await handleStep1Complete(formData);
            return;
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
                            onClick={() => projectId && setCurrentStep(step.id)} // Only allow nav if project created
                            disabled={!projectId && step.id > 1}
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
                                    disabled={currentStep === STEPS.length || (!projectId && currentStep === 1 && !formData.address)}
                                >
                                    {creatingProject ? "Creating..." : "Next"}
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

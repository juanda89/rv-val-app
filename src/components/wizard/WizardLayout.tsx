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
import { BarChart3 } from 'lucide-react';

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

        let updates: Record<string, any> = {};
        setFormData((prev: any) => {
            const next = { ...prev };
            Object.entries(extracted).forEach(([key, value]) => {
                if (isEmptyValue(next[key])) {
                    next[key] = value;
                    updates[key] = value;
                }
            });
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
        <div className="flex min-h-screen bg-[#111618] text-white">
            {/* Sidebar */}
            <div className="w-64 border-r border-[#283339] hidden md:flex flex-col p-6 sticky top-0 h-screen">
                <Link href="/" className="flex items-center gap-2 mb-8 hover:opacity-90">
                    <BarChart3 className="w-6 h-6 text-blue-500" />
                    <h1 className="font-bold text-xl">RV Valuations</h1>
                </Link>

                <nav className="space-y-2">
                    {STEPS.map(step => (
                        <button
                            key={step.id}
                            onClick={() => projectId && setCurrentStep(step.id)} // Only allow nav if project created
                            disabled={!projectId && step.id > 1}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${currentStep === step.id ? 'bg-[#283339] border-l-4 border-blue-500 text-white' : 'text-gray-400 hover:bg-white/5'}`}
                        >
                            <span className="material-symbols-outlined">{step.icon}</span>
                            <span className="text-sm font-medium">{step.title}</span>
                        </button>
                    ))}
                </nav>

                <div className="mt-auto pt-6 border-t border-[#283339]">
                    {projectId && (
                        <div className="text-xs text-gray-500">
                            Project ID: <span className="font-mono text-gray-400">{projectId.slice(0, 8)}...</span>
                            <div className="mt-2 flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></span>
                                {isSyncing ? 'Syncing...' : 'Synced'}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row">
                <ValuationUploadPanel onAutofill={handleAutofill} />

                {/* Main Content */}
                <div className="flex-1 flex flex-col">
                    <header className="h-16 border-b border-[#283339] flex items-center justify-between px-8 bg-[#111618]/95 backdrop-blur sticky top-0 z-10">
                        <h2 className="text-lg font-semibold">{STEPS[currentStep - 1].title}</h2>
                        <div className="flex gap-4">
                            {currentStep === 1 && !projectId ? (
                                <Button variant="ghost" className="text-gray-400" onClick={() => router.push('/')}>
                                    Cancel
                                </Button>
                            ) : (
                                <Button variant="ghost" className="text-gray-400" onClick={prevStep} disabled={currentStep === 1}>Back</Button>
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
                        {currentStep === 3 && <Step3PnL onDataChange={handleDataChange} initialData={formData} />}
                        {currentStep === 4 && <Step4Taxes onDataChange={handleDataChange} initialData={formData} address={formData.address} />}
                        {currentStep === 5 && <Dashboard outputs={outputs} inputs={formData} onInputChange={handleDataChange} />}
                    </main>
                </div>
            </div>
        </div>
    );
};

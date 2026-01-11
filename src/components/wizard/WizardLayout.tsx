"use client";

import React, { useState } from 'react';
import { Step1Location } from './Step1Location';
import { Step2RentRoll } from './Step2RentRoll';
import { Step3PnL } from './Step3PnL';
import { Step4Taxes } from './Step4Taxes';
import { Button } from "@/components/ui/Button";
import { useSheetSync } from '@/hooks/useSheetSync';
import { Dashboard } from '@/components/dashboard/Dashboard';

const STEPS = [
    { id: 1, title: 'Property Basics', icon: 'domain' },
    { id: 2, title: 'Rent Roll', icon: 'list_alt' },
    { id: 3, title: 'P&L Upload', icon: 'upload_file' },
    { id: 4, title: 'Taxes', icon: 'account_balance' },
    { id: 5, title: 'Results', icon: 'analytics' },
];

export const WizardLayout = () => {
    const [mounted, setMounted] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null; // Prevent hydration mismatch

    const [formData, setFormData] = useState<any>({});
    const [outputs, setOutputs] = useState<any>(null); // Store sync results
    const [projectId, setProjectId] = useState<string | null>(null);
    const [creatingProject, setCreatingProject] = useState(false);

    const { sync, isSyncing } = useSheetSync(projectId || '');

    const handleDataChange = async (stepData: any) => {
        const newData = { ...formData, ...stepData };
        setFormData(newData);

        // If we have a project ID, sync immediately (debounced ideally, but hook handles async)
        if (projectId) {
            const results = await sync(stepData);
            if (results) {
                setOutputs((prev: any) => ({ ...prev, ...results }));
            }
        }
    };

    const handleStep1Complete = async (data: any) => {
        // Special handling for Step 1: Create Project if not exists
        if (!projectId) {
            setCreatingProject(true);
            try {
                const res = await fetch('/api/projects/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: data.address || 'New Project',
                        address: data.address,
                        user_id: 'test-user-id-placeholder' // In real app, get from Supabase Auth Context
                    })
                });
                const json = await res.json();
                if (json.project?.id) {
                    setProjectId(json.project.id);
                    // Sync the initial data
                    const results = await fetch('/api/sheet/sync', {
                        method: 'POST',
                        body: JSON.stringify({ projectId: json.project.id, inputs: data })
                    }).then(r => r.json()).then(d => d.results);
                    setOutputs(results);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setCreatingProject(false);
            }
        }
        handleDataChange(data);
    };

    const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

    return (
        <div className="flex min-h-screen bg-[#111618] text-white">
            {/* Sidebar */}
            <div className="w-64 border-r border-[#283339] hidden md:flex flex-col p-6 sticky top-0 h-screen">
                <div className="flex items-center gap-2 mb-8">
                    <span className="material-symbols-outlined text-blue-500 text-2xl">rv_hookup</span>
                    <h1 className="font-bold text-xl">ValuParks</h1>
                </div>

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

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                <header className="h-16 border-b border-[#283339] flex items-center justify-between px-8 bg-[#111618]/95 backdrop-blur sticky top-0 z-10">
                    <h2 className="text-lg font-semibold">{STEPS[currentStep - 1].title}</h2>
                    <div className="flex gap-4">
                        <Button variant="ghost" className="text-gray-400" onClick={prevStep} disabled={currentStep === 1}>Back</Button>
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
                    {currentStep === 1 && <Step1Location onDataChange={handleStep1Complete} initialData={formData} />}
                    {currentStep === 2 && <Step2RentRoll onDataChange={handleDataChange} initialData={formData} />}
                    {currentStep === 3 && <Step3PnL onDataChange={handleDataChange} initialData={formData} />}
                    {currentStep === 4 && <Step4Taxes onDataChange={handleDataChange} initialData={formData} address={formData.address} />}
                    {currentStep === 5 && <Dashboard outputs={outputs} inputs={formData} onInputChange={handleDataChange} />}
                </main>
            </div>
        </div>
    );
};

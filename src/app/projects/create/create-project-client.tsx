"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { WizardLayout } from "@/components/wizard/WizardLayout";
import { supabase } from '@/lib/supabaseClient';

export const CreateProjectClient = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const projectIdParam = searchParams.get('projectId');
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [projectData, setProjectData] = useState<any>(null);
    const [projectLoading, setProjectLoading] = useState(false);
    const [projectError, setProjectError] = useState<string | null>(null);

    const fetchSheetData = async (projectId: string) => {
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
            throw new Error(payload?.error || 'Failed to load sheet data');
        }

        return payload;
    };

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/login');
            } else {
                setUser(session.user);
            }
            setLoading(false);
        };
        checkUser();
    }, [router]);

    useEffect(() => {
        if (!projectIdParam || !user) {
            setProjectData(null);
            setProjectError(null);
            setProjectLoading(false);
            return;
        }

        let isActive = true;
        const fetchProject = async () => {
            setProjectLoading(true);
            setProjectError(null);
            const { data, error } = await supabase
                .from('projects')
                .select('id, name, address, spreadsheet_id')
                .eq('id', projectIdParam)
                .single();

            if (!isActive) return;

            if (error || !data) {
                console.error('Error fetching project:', error);
                setProjectError('Project not found');
                setProjectData(null);
            } else {
                try {
                    const sheetPayload = await fetchSheetData(data.id);
                    const inputs = sheetPayload?.inputs || {};
                    const pnl = sheetPayload?.pnl || {};

                    setProjectData({
                        name: data.name,
                        address: data.address,
                        spreadsheet_id: data.spreadsheet_id,
                        ...inputs,
                        pnl_income_items: pnl.incomeItems || [],
                        pnl_expense_items: pnl.expenseItems || [],
                        pnl_grouped_income: pnl.groupedIncome || [],
                        pnl_grouped_expenses: pnl.groupedExpenses || [],
                    });
                } catch (sheetError: any) {
                    console.error('Error loading sheet data:', sheetError);
                    setProjectData({ name: data.name, address: data.address, spreadsheet_id: data.spreadsheet_id });
                }
            }
            setProjectLoading(false);
        };

        fetchProject();

        return () => {
            isActive = false;
        };
    }, [projectIdParam, user]);

    if (loading || projectLoading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-[#111618] flex items-center justify-center">
                <div className="text-slate-600 dark:text-white">Loading...</div>
            </div>
        );
    }

    if (!user) return null;
    if (projectError) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-[#111618] flex items-center justify-center">
                <div className="text-slate-700 dark:text-white flex flex-col gap-4 items-center">
                    <p>{projectError}</p>
                    <button
                        className="px-4 py-2 rounded bg-[#13a4ec] text-white"
                        onClick={() => router.push('/valuations')}
                    >
                        Back to projects
                    </button>
                </div>
            </div>
        );
    }

    return (
        <WizardLayout user={user} initialProjectId={projectIdParam} initialData={projectData || {}} />
    );
};

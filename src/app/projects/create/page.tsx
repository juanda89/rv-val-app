"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WizardLayout } from "@/components/wizard/WizardLayout";
import { supabase } from '@/lib/supabaseClient';

export default function CreateProjectPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

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

    if (loading) {
        return (
            <div className="min-h-screen bg-[#111618] flex items-center justify-center">
                <div className="text-white">Loading...</div>
            </div>
        )
    }

    if (!user) return null;

    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />
            <WizardLayout user={user} />
        </>
    );
}

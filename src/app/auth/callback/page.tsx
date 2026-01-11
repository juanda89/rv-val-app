"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
    const router = useRouter();

    useEffect(() => {
        // Supabase handles the hash parsing automatically if we just initialize the client
        // creating an auth listener will catch the session update
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || session) {
                router.replace('/'); // Redirect to dashboard
            }
        });

        return () => subscription.unsubscribe();
    }, [router]);

    return (
        <div className="min-h-screen bg-[#111618] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-10 h-10 text-[#13a4ec] animate-spin" />
                <p className="text-slate-400">Finalizing login...</p>
            </div>
        </div>
    );
}

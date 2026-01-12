"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
    const router = useRouter();

    useEffect(() => {
        let isActive = true;

        const finalizeLogin = async () => {
            const params = new URLSearchParams(window.location.search);
            const error = params.get('error');
            const code = params.get('code');

            if (error) {
                router.replace('/login?error=oauth_failed');
                return;
            }

            if (code) {
                const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href);
                if (exchangeError) {
                    console.error('OAuth exchange failed:', exchangeError.message);
                    router.replace('/login?error=oauth_failed');
                    return;
                }
            }

            const { data: { session } } = await supabase.auth.getSession();
            if (session && isActive) {
                router.replace('/valuations');
            }
        };

        void finalizeLogin();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session && isActive) {
                router.replace('/valuations');
            }
        });

        return () => {
            isActive = false;
            subscription.unsubscribe();
        };
    }, [router]);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#111618] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-10 h-10 text-[#13a4ec] animate-spin" />
                <p className="text-slate-500 dark:text-slate-400">Finalizing login...</p>
            </div>
        </div>
    );
}

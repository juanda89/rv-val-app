import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function useSheetSync(projectId: string) {
    const [isSyncing, setIsSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const sync = useCallback(async (inputs: Record<string, any>) => {
        if (!projectId) return null;
        setIsSyncing(true);
        setError(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const response = await fetch('/api/sheet/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ projectId, inputs }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Sync failed');
            }

            return data.results;
        } catch (err: any) {
            setError(err.message);
            console.error('Sync Error:', err);
            return null;
        } finally {
            setIsSyncing(false);
        }
    }, [projectId]);

    return { sync, isSyncing, error };
}

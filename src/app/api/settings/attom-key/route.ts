import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { clearAttomKeyCache, getAttomApiKeyStatus, maskApiKey } from '@/lib/attomKey';

const SETTINGS_KEY = 'ATTOM_API_KEY';

const getEnv = () => ({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
});

const getBearerToken = (req: Request) => {
    const authHeader = req.headers.get('Authorization') || '';
    const prefix = 'Bearer ';
    if (!authHeader.startsWith(prefix)) return null;
    const token = authHeader.slice(prefix.length).trim();
    return token || null;
};

const getAuthedClients = async (req: Request) => {
    const { supabaseUrl, anonKey, serviceRoleKey } = getEnv();
    if (!supabaseUrl || !anonKey) {
        throw new Error('Supabase environment is not configured');
    }

    const token = getBearerToken(req);
    if (!token) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const verifier = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: userError } = await verifier.auth.getUser(token);
    if (userError || !user) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const dbClient = serviceRoleKey
        ? createClient(supabaseUrl, serviceRoleKey)
        : createClient(supabaseUrl, anonKey, {
            global: {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            },
        });

    return { dbClient, user };
};

export async function GET(req: Request) {
    try {
        const auth = await getAuthedClients(req);
        if ('error' in auth) return auth.error;

        const status = await getAttomApiKeyStatus();
        let updatedAt: string | undefined;

        const { data, error } = await auth.dbClient
            .from('app_settings')
            .select('updated_at')
            .eq('key', SETTINGS_KEY)
            .maybeSingle();

        if (!error && data?.updated_at) {
            updatedAt = data.updated_at;
        }

        return NextResponse.json({
            hasKey: status.hasKey,
            source: status.source,
            maskedKey: status.value ? maskApiKey(status.value) : undefined,
            updatedAt,
        });
    } catch (error: any) {
        console.error('Failed to load ATTOM key status:', error);
        return NextResponse.json(
            { error: error?.message || 'Failed to load ATTOM key status' },
            { status: 500 }
        );
    }
}

export async function POST(req: Request) {
    try {
        const auth = await getAuthedClients(req);
        if ('error' in auth) return auth.error;

        const body = await req.json();
        const apiKey = String(body?.apiKey || '').trim();
        if (!apiKey) {
            return NextResponse.json({ error: 'apiKey is required' }, { status: 400 });
        }

        const now = new Date().toISOString();
        const { error } = await auth.dbClient
            .from('app_settings')
            .upsert(
                {
                    key: SETTINGS_KEY,
                    value: apiKey,
                    updated_by: auth.user.id,
                    updated_at: now,
                },
                { onConflict: 'key' }
            );

        if (error) {
            console.error('Failed to save ATTOM key:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        clearAttomKeyCache();

        return NextResponse.json({
            ok: true,
            source: 'db',
            maskedKey: maskApiKey(apiKey),
            updatedAt: now,
        });
    } catch (error: any) {
        console.error('Failed to save ATTOM key:', error);
        return NextResponse.json(
            { error: error?.message || 'Failed to save ATTOM key' },
            { status: 500 }
        );
    }
}


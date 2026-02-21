import { createClient } from '@supabase/supabase-js';

const SETTINGS_KEY = 'ATTOM_API_KEY';
const CACHE_TTL_MS = 60_000;

let cachedValue: string | null = null;
let cachedAt = 0;

const getSupabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const getServiceRoleKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const canUseServiceRole = () => Boolean(getSupabaseUrl() && getServiceRoleKey());

const normalizeKey = (value: unknown) => {
    const normalized = String(value ?? '').trim();
    return normalized || null;
};

export const maskApiKey = (value: string | null) => {
    if (!value) return '';
    const clean = value.trim();
    if (clean.length <= 4) return `••••${clean}`;
    return `${'•'.repeat(Math.max(6, clean.length - 3))}${clean.slice(-3)}`;
};

export const clearAttomKeyCache = () => {
    cachedValue = null;
    cachedAt = 0;
};

const fetchDbAttomApiKey = async () => {
    if (!canUseServiceRole()) return null;

    const supabase = createClient(getSupabaseUrl(), getServiceRoleKey());
    const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', SETTINGS_KEY)
        .maybeSingle();

    if (error) {
        console.warn('Failed to read ATTOM API key from DB:', error.message);
        return null;
    }

    return normalizeKey(data?.value);
};

export const getAttomApiKey = async (): Promise<string | null> => {
    if (Date.now() - cachedAt < CACHE_TTL_MS) {
        return cachedValue || process.env.ATTOM_API_KEY || null;
    }

    const dbValue = await fetchDbAttomApiKey();
    if (dbValue) {
        cachedValue = dbValue;
        cachedAt = Date.now();
        return dbValue;
    }

    cachedValue = null;
    cachedAt = Date.now();
    return process.env.ATTOM_API_KEY || null;
};

export const getAttomApiKeyStatus = async () => {
    const dbValue = await fetchDbAttomApiKey();
    if (dbValue) {
        return {
            hasKey: true,
            source: 'db' as const,
            value: dbValue,
        };
    }

    const envValue = normalizeKey(process.env.ATTOM_API_KEY);
    if (envValue) {
        return {
            hasKey: true,
            source: 'env' as const,
            value: envValue,
        };
    }

    return {
        hasKey: false,
        source: 'none' as const,
        value: null,
    };
};


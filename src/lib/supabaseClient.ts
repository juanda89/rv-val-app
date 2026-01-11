import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const createMissingEnvProxy = () =>
    new Proxy(
        {},
        {
            get() {
                throw new Error('Missing Supabase environment variables')
            }
        }
    ) as ReturnType<typeof createClient>

export const supabase =
    supabaseUrl && supabaseAnonKey
        ? createClient(supabaseUrl, supabaseAnonKey)
        : createMissingEnvProxy()

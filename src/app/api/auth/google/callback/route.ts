import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const getBaseUrl = (req: Request) => {
    const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL;
    if (envUrl) return envUrl.startsWith('http') ? envUrl : `https://${envUrl}`;
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') ?? 'https';
    return host ? `${proto}://${host}` : 'http://localhost:3000';
};

export async function GET(req: Request) {
    const baseUrl = getBaseUrl(req);
    try {
        const { searchParams } = new URL(req.url);
        const code = searchParams.get('code');
        const error = searchParams.get('error');

        console.log('OAuth callback received:', { code: !!code, error });

        if (error) {
            return NextResponse.redirect(`${baseUrl}/projects/create?error=access_denied`);
        }

        if (!code) {
            return NextResponse.json({ error: 'No authorization code' }, { status: 400 });
        }

        // Exchange code for tokens
        const redirectUri = `${baseUrl}/api/auth/google/callback`;
        const oauth2Client = new google.auth.OAuth2(
            process.env.PERSONALCLIENT,
            process.env.PERSONALSECRET,
            redirectUri
        );

        const { tokens } = await oauth2Client.getToken(code);
        console.log('Got tokens:', { hasAccess: !!tokens.access_token, hasRefresh: !!tokens.refresh_token });

        if (!tokens.access_token || !tokens.refresh_token) {
            throw new Error('Failed to get tokens');
        }

        // Get cookies from request
        const cookieStore = await cookies();
        const allCookies = cookieStore.getAll();
        const cookieString = allCookies.map(c => `${c.name}=${c.value}`).join('; ');

        console.log('Cookies found:', allCookies.length);

        // Get user from Supabase session
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                global: {
                    headers: {
                        cookie: cookieString,
                    },
                },
            }
        );

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        console.log('Supabase user:', { userId: user?.id, error: userError?.message });

        if (!user) {
            console.error('No user found, redirecting to login');
            return NextResponse.redirect(`${baseUrl}/login?error=no_session`);
        }

        // Store tokens in Supabase
        const { error: dbError } = await supabase
            .from('user_google_tokens')
            .upsert({
                user_id: user.id,
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_at: new Date(tokens.expiry_date || Date.now() + 3600000).toISOString()
            });

        if (dbError) {
            console.error('Error storing tokens:', dbError);
            throw dbError;
        }

        console.log('Tokens stored successfully, redirecting to projects/create');

        // Redirect back to project creation
        return NextResponse.redirect(`${baseUrl}/projects/create?drive_connected=true`);

    } catch (error: any) {
        console.error('OAuth callback error:', error);
        return NextResponse.redirect(`${baseUrl}/projects/create?error=oauth_failed`);
    }
}

import { NextResponse } from 'next/server';
import { google } from 'googleapis';

const getBaseUrl = (req: Request) => {
    const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL;
    if (envUrl) return envUrl.startsWith('http') ? envUrl : `https://${envUrl}`;
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') ?? 'https';
    return host ? `${proto}://${host}` : 'http://localhost:3000';
};

export async function GET(req: Request) {
    const clientId = process.env.PERSONALCLIENT;
    const clientSecret = process.env.PERSONALSECRET;
    const baseUrl = getBaseUrl(req);
    const redirectUri = `${baseUrl}/api/auth/google/callback`;

    console.log('OAuth Config:', { clientId: clientId?.substring(0, 20), redirectUri });

    if (!clientId || !clientSecret) {
        return NextResponse.json({ error: 'Missing OAuth credentials' }, { status: 500 });
    }

    const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri
    );

    const scopes = [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/spreadsheets'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent',
        redirect_uri: redirectUri // Explicitly set it again
    });

    console.log('Generated auth URL:', authUrl);

    return NextResponse.redirect(authUrl);
}

import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET() {
    const clientId = process.env.PERSONALCLIENT;
    const clientSecret = process.env.PERSONALSECRET;
    const redirectUri =
        process.env.GOOGLE_OAUTH_REDIRECT_URI ||
        `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/auth/google/callback`;

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

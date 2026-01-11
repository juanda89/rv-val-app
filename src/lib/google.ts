import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'];

export const getGoogleAuth = () => {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!email || !privateKey) {
        throw new Error('Missing Google Service Account credentials');
    }

    return new google.auth.JWT({
        email,
        key: privateKey,
        scopes: SCOPES,
    });
};

export const getSheetsClient = async () => {
    const auth = getGoogleAuth();
    return google.sheets({ version: 'v4', auth });
};

export const getDriveClient = async () => {
    const auth = getGoogleAuth();
    return google.drive({ version: 'v3', auth });
};

export const getDriveClientWithOAuth = (accessToken: string) => {
    const redirectUri =
        process.env.GOOGLE_OAUTH_REDIRECT_URI ||
        `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/auth/google/callback`;
    const oauth2Client = new google.auth.OAuth2(
        process.env.PERSONALCLIENT,
        process.env.PERSONALSECRET,
        redirectUri
    );

    oauth2Client.setCredentials({ access_token: accessToken });

    return google.drive({ version: 'v3', auth: oauth2Client });
};

export const getSheetsClientWithOAuth = (accessToken: string) => {
    const redirectUri =
        process.env.GOOGLE_OAUTH_REDIRECT_URI ||
        `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/auth/google/callback`;
    const oauth2Client = new google.auth.OAuth2(
        process.env.PERSONALCLIENT,
        process.env.PERSONALSECRET,
        redirectUri
    );

    oauth2Client.setCredentials({ access_token: accessToken });

    return google.sheets({ version: 'v4', auth: oauth2Client });
};

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

export const getOAuthClientFromEnv = async (req?: Request) => {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN?.trim();

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Google OAuth credentials not configured');
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : req ? new URL(req.url).origin : 'http://localhost:3000');
    const redirectUri = `${baseUrl}/api/auth/google/callback`;

    const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri
    );

    oauth2Client.setCredentials({
        refresh_token: refreshToken,
    });

    // Force token refresh validation here so routes can fail early and explicitly.
    await oauth2Client.getAccessToken();
    return oauth2Client;
};

export const getDriveClientWithEnvOAuth = async (req?: Request) => {
    const oauthClient = await getOAuthClientFromEnv(req);
    return google.drive({ version: 'v3', auth: oauthClient });
};

export const getFileMetadata = async (fileId: string) => {
    const drive = await getDriveClient();
    const response = await drive.files.get({
        fileId,
        supportsAllDrives: true,
        fields: 'id,name,driveId,mimeType',
    });
    return response.data;
};

export const getFolderMetadata = async (folderId: string) => {
    const drive = await getDriveClient();
    const response = await drive.files.get({
        fileId: folderId,
        supportsAllDrives: true,
        fields: 'id,name,driveId,mimeType,capabilities(canAddChildren)',
    });
    return response.data;
};

export const copyFileToFolder = async ({
    sourceFileId,
    targetFolderId,
    name,
    mimeType = 'application/vnd.google-apps.spreadsheet',
}: {
    sourceFileId: string;
    targetFolderId: string;
    name: string;
    mimeType?: string;
}) => {
    const drive = await getDriveClient();
    const response = await drive.files.copy({
        fileId: sourceFileId,
        supportsAllDrives: true,
        fields: 'id,name,driveId',
        requestBody: {
            name,
            mimeType,
            parents: [targetFolderId],
        },
    });
    return response.data;
};

export const getDriveClientWithOAuth = (accessToken: string, refreshToken?: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const redirectUri = `${baseUrl}/api/auth/google/callback`;
    const oauth2Client = new google.auth.OAuth2(
        process.env.PERSONALCLIENT,
        process.env.PERSONALSECRET,
        redirectUri
    );

    oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken
    });

    return google.drive({ version: 'v3', auth: oauth2Client });
};

export const getSheetsClientWithOAuth = (accessToken: string, refreshToken?: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const redirectUri = `${baseUrl}/api/auth/google/callback`;
    const oauth2Client = new google.auth.OAuth2(
        process.env.PERSONALCLIENT,
        process.env.PERSONALSECRET,
        redirectUri
    );

    oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken
    });

    return google.sheets({ version: 'v4', auth: oauth2Client });
};

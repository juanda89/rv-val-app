import { NextResponse } from 'next/server';
import { getDriveClient } from '@/lib/google';

export const runtime = 'nodejs';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const spreadsheetId = searchParams.get('spreadsheetId');
        const fileNameParam = searchParams.get('fileName') || 'valuation-report';

        if (!spreadsheetId) {
            return NextResponse.json({ error: 'Missing spreadsheetId' }, { status: 400 });
        }

        const drive = await getDriveClient();
        const exportResponse = await drive.files.export(
            {
                fileId: spreadsheetId,
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            },
            {
                responseType: 'arraybuffer',
            }
        );

        const data = Buffer.from(exportResponse.data as ArrayBuffer);
        const fileName = fileNameParam.endsWith('.xlsx') ? fileNameParam : `${fileNameParam}.xlsx`;

        return new NextResponse(data, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (error: any) {
        console.error('Report download failed:', error);
        return NextResponse.json(
            { error: error?.message || 'Failed to download report' },
            { status: 500 }
        );
    }
}


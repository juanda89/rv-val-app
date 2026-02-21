import { NextResponse } from 'next/server';
import { getDriveClient } from '@/lib/google';

export async function GET() {
    try {
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
        if (!folderId) {
            return NextResponse.json(
                { error: 'GOOGLE_DRIVE_FOLDER_ID not configured' },
                { status: 500 }
            );
        }

        const drive = await getDriveClient();

        // List files only from the configured app folder.
        const res = await drive.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            fields: 'files(id, name, size)',
            pageSize: 100,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
        });

        const files = res.data.files || [];
        const deleted = [];
        const errors = [];

        for (const file of files) {
            try {
                if (file.id) {
                    await drive.files.delete({
                        fileId: file.id,
                        supportsAllDrives: true,
                    });
                    deleted.push(file.name);
                }
            } catch (e: any) {
                errors.push({ name: file.name, error: e.message });
            }
        }

        // Also empty trash to ensure quota is freed
        try {
            await drive.files.emptyTrash({});
        } catch (e) {
            console.error("Error emptying trash", e);
        }

        return NextResponse.json({
            message: 'Cleanup complete',
            deletedCount: deleted.length,
            deletedFiles: deleted,
            errors
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

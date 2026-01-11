import { NextResponse } from 'next/server';
import { SHEET_MAPPING } from '@/config/sheetMapping';

export const runtime = 'nodejs';

const SUPPORTED_MIME_TYPES = new Set([
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/pdf',
]);

const getMimeType = (file: File) => {
    if (file.type) return file.type;
    const name = file.name.toLowerCase();
    if (name.endsWith('.csv')) return 'text/csv';
    if (name.endsWith('.xls')) return 'application/vnd.ms-excel';
    if (name.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (name.endsWith('.pdf')) return 'application/pdf';
    return '';
};

const buildPrompt = (keys: string[]) => `
You are an extraction service for RV valuation documents.
Extract data only for the following keys and return a valid JSON object.
If a value is missing or unknown, omit the key entirely.
Return numbers when possible.

Keys:
${keys.join(', ')}
`;

export async function POST(req: Request) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Missing GEMINI_API_KEY' }, { status: 500 });
        }

        const formData = await req.formData();
        const file = formData.get('file');

        if (!file || !(file instanceof File)) {
            return NextResponse.json({ error: 'Missing file' }, { status: 400 });
        }

        const mimeType = getMimeType(file);
        if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
            return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');

        const keys = Object.keys(SHEET_MAPPING.inputs).filter(key => key !== 'sheetName');
        const prompt = buildPrompt(keys);

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        {
                            role: 'user',
                            parts: [
                                { text: prompt },
                                {
                                    inline_data: {
                                        mime_type: mimeType,
                                        data: base64
                                    }
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.1,
                        response_mime_type: 'application/json'
                    }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json(
                { error: 'Gemini request failed', details: errorText },
                { status: 500 }
            );
        }

        const json = await response.json();
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text || typeof text !== 'string') {
            return NextResponse.json({ error: 'Gemini returned no content' }, { status: 500 });
        }

        let parsed: Record<string, any> = {};
        try {
            parsed = JSON.parse(text);
        } catch (parseError) {
            return NextResponse.json(
                { error: 'Unable to parse Gemini response', raw: text },
                { status: 500 }
            );
        }

        const filtered: Record<string, any> = {};
        keys.forEach((key) => {
            const value = parsed[key];
            if (value !== undefined && value !== null && value !== '') {
                filtered[key] = value;
            }
        });

        return NextResponse.json({ data: filtered });
    } catch (error: any) {
        console.error('Valuation analyze failed:', error);
        return NextResponse.json({ error: error.message || 'Analysis failed' }, { status: 500 });
    }
}

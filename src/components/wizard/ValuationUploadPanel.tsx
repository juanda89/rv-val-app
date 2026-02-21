"use client";

import React, { useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { ApiProvider } from '@/types/apiProvider';
import { API_PROVIDER_LABELS } from '@/types/apiProvider';

type UploadStatus = 'idle' | 'loading' | 'success' | 'error';

interface ValuationUploadPanelProps {
    onAutofill: (data: Record<string, any>) => Promise<void> | void;
    onBusyChange?: (busy: boolean) => void;
    selectedApi: ApiProvider | null;
    onApiChange: (provider: ApiProvider | null) => void;
}

const SUPPORTED_EXTENSIONS = ['.csv', '.xls', '.xlsx', '.pdf'];
const STORAGE_BUCKET = 'valuation-uploads';

const sanitizeFileName = (name: string) =>
    name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');

export const ValuationUploadPanel: React.FC<ValuationUploadPanelProps> = ({
    onAutofill,
    onBusyChange,
    selectedApi,
    onApiChange,
}) => {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [status, setStatus] = useState<UploadStatus>('idle');
    const [message, setMessage] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [fileName, setFileName] = useState('');
    const busyCallbackRef = useRef<ValuationUploadPanelProps['onBusyChange']>(onBusyChange);

    React.useEffect(() => {
        busyCallbackRef.current = onBusyChange;
    }, [onBusyChange]);

    React.useEffect(() => {
        busyCallbackRef.current?.(status === 'loading');
    }, [status]);

    const reset = () => {
        setStatus('idle');
        setMessage('');
        setIsDragging(false);
        setFileName('');
        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    const uploadToStorage = async (file: File) => {
        const safeName = sanitizeFileName(file.name);
        const filePath = `uploads/${Date.now()}-${safeName}`;

        const { error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true,
                contentType: file.type || 'application/octet-stream'
            });

        if (error) {
            throw new Error(error.message || 'Storage upload failed');
        }

        const { data: signed, error: signedError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(filePath, 60 * 60);

        if (!signedError && signed?.signedUrl) {
            return signed.signedUrl;
        }

        const { data: publicUrl } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
        if (!publicUrl?.publicUrl) {
            throw new Error('Unable to generate file URL');
        }

        return publicUrl.publicUrl;
    };

    const parseJsonSafely = async (response: Response) => {
        try {
            return await response.json();
        } catch {
            return {};
        }
    };

    const analyzeViaStorageUrl = async (file: File) => {
        const fileUrl = await uploadToStorage(file);
        const response = await fetch('/api/valuation/analyze-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileUrl,
                fileName: file.name,
                mimeType: file.type || ''
            })
        });
        const payload = await parseJsonSafely(response);
        if (!response.ok) {
            throw new Error(payload.error || 'Unable to analyze document');
        }
        return payload?.data || {};
    };

    const analyzeViaDirectUpload = async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch('/api/valuation/analyze', {
            method: 'POST',
            body: formData,
        });
        const payload = await parseJsonSafely(response);
        if (!response.ok) {
            throw new Error(payload.error || 'Unable to analyze document');
        }
        return payload?.data || {};
    };

    const processFile = async (file: File) => {
        setStatus('loading');
        setMessage('Uploading file and analyzing with AI...');
        setFileName(file.name);

        try {
            let analyzedData: Record<string, any> | null = null;
            try {
                analyzedData = await analyzeViaStorageUrl(file);
            } catch (storagePathError: any) {
                console.warn('Storage-based analyze failed, falling back to direct upload:', storagePathError?.message || storagePathError);
                setMessage('Primary upload failed. Retrying with direct analysis...');
                analyzedData = await analyzeViaDirectUpload(file);
            }

            await onAutofill(analyzedData || {});
            setStatus('success');
            setMessage('Documento analizado correctamente. Los campos disponibles han sido completados.');
        } catch (error: any) {
            console.error('Gemini analysis failed:', error);
            setStatus('error');
            setMessage(
                error?.message?.includes('Storage')
                    ? 'No fue posible subir el archivo. Verifica el bucket de Storage.'
                    : 'No fue posible analizar el documento. Intenta con otro archivo o revisa el formato.'
            );
        } finally {
            setTimeout(reset, 2500);
        }
    };

    const handleFileSelect = async (file?: File | null) => {
        if (!file || status === 'loading') return;
        await processFile(file);
    };

    const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (status === 'loading') return;
        setIsDragging(false);
        await handleFileSelect(event.dataTransfer.files?.[0]);
    };

    const handleApiToggle = (target: ApiProvider) => {
        if (selectedApi === target) return;
        onApiChange(target);
    };

    return (
        <aside className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-[#283339] bg-slate-100 dark:bg-[#0f1418] text-slate-900 dark:text-white px-6 py-6 h-full transition-colors duration-200">
            <div className="sticky top-6 space-y-6">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#13a4ec]">upload_file</span>
                        <h3 className="text-lg font-semibold">Upload Documents</h3>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-2">
                        Drag & drop or upload supporting files. AI will extract data to auto-fill your valuation.
                    </p>
                </div>

                <div
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                        isDragging ? 'border-[#13a4ec] bg-[#13a4ec]/10' : 'border-slate-300 dark:border-[#283339] bg-white dark:bg-[#141b21]'
                    } ${status === 'loading' ? 'opacity-60 pointer-events-none' : ''}`}
                    onDragOver={(event) => {
                        event.preventDefault();
                        if (status !== 'loading') setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                >
                    <input
                        ref={inputRef}
                        type="file"
                        accept=".csv,.xls,.xlsx,.pdf"
                        className="hidden"
                        disabled={status === 'loading'}
                        onChange={(event) => handleFileSelect(event.target.files?.[0])}
                    />
                    <div className="flex flex-col items-center gap-2">
                        <span className="material-symbols-outlined text-3xl text-[#13a4ec]">cloud_upload</span>
                        <p className="text-sm font-semibold">
                            {fileName ? fileName : 'Drop files here'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-gray-400">CSV, XLS/XLSX, PDF</p>
                        <button
                            onClick={() => inputRef.current?.click()}
                            className="mt-3 px-4 py-2 rounded-lg text-xs font-semibold bg-[#13a4ec] hover:bg-sky-500 text-white transition-colors"
                            disabled={status === 'loading'}
                            type="button"
                        >
                            Upload file
                        </button>
                    </div>
                </div>

                {status === 'loading' && (
                    <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 text-xs text-sky-700 dark:text-sky-200 space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                            <span>Uploading file...</span>
                        </div>
                        <p>AI is analyzing the document.</p>
                        <p>Processing and structuring the extracted data.</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-700 dark:text-emerald-200">
                        {message}
                    </div>
                )}

                {status === 'error' && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-700 dark:text-red-200">
                        {message}
                    </div>
                )}

                <div className="text-[11px] text-slate-500 dark:text-gray-500 space-y-2">
                    <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-sm">verified</span>
                        <span>Only empty fields will be auto-completed.</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-sm">lock</span>
                        <span>Your existing inputs will never be overwritten.</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-sm">restore</span>
                        <span>Upload card resets after each analysis.</span>
                    </div>
                </div>

                <div className="text-[11px] text-slate-500 dark:text-gray-500">
                    Supported formats: {SUPPORTED_EXTENSIONS.join(', ').toUpperCase()}
                </div>

                <div className="border-t border-slate-200 dark:border-[#283339] pt-5 space-y-3">
                    <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-gray-300">
                            API Sources
                        </h4>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                        {(['melissa', 'attom', 'rentcast', 'reportallusa'] as ApiProvider[]).map((provider) => {
                            const isOn = selectedApi === provider;
                            return (
                                <button
                                    key={provider}
                                    type="button"
                                    onClick={() => handleApiToggle(provider)}
                                    className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                                        isOn
                                            ? 'border-[#13a4ec] bg-[#13a4ec]/10 text-[#13a4ec]'
                                            : 'border-slate-300 dark:border-[#283339] bg-white dark:bg-[#141b21] text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-[#192229]'
                                    }`}
                                >
                                    <span>{API_PROVIDER_LABELS[provider]}</span>
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ${
                                        isOn
                                            ? 'bg-[#13a4ec] text-white'
                                            : 'bg-slate-200 text-slate-600 dark:bg-[#283339] dark:text-gray-300'
                                    }`}>
                                        {isOn ? 'ON' : 'OFF'}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </aside>
    );
};

"use client";

import React, { useRef, useState } from 'react';

type UploadStatus = 'idle' | 'loading' | 'success' | 'error';

interface ValuationUploadPanelProps {
    onAutofill: (data: Record<string, any>) => Promise<void> | void;
}

const SUPPORTED_EXTENSIONS = ['.csv', '.xls', '.xlsx', '.pdf'];

export const ValuationUploadPanel: React.FC<ValuationUploadPanelProps> = ({ onAutofill }) => {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [status, setStatus] = useState<UploadStatus>('idle');
    const [message, setMessage] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [fileName, setFileName] = useState('');

    const reset = () => {
        setStatus('idle');
        setMessage('');
        setIsDragging(false);
        setFileName('');
        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    const processFile = async (file: File) => {
        setStatus('loading');
        setMessage('Uploading file and analyzing with Gemini...');
        setFileName(file.name);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/valuation/analyze', {
                method: 'POST',
                body: formData
            });

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.error || 'Unable to analyze document');
            }

            await onAutofill(payload.data || {});
            setStatus('success');
            setMessage('Documento analizado correctamente. Los campos disponibles han sido completados.');
        } catch (error: any) {
            console.error('Gemini analysis failed:', error);
            setStatus('error');
            setMessage('No fue posible analizar el documento. Intenta con otro archivo o revisa el formato.');
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

    return (
        <aside className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-[#283339] bg-[#0f1418] text-white px-6 py-6 h-full">
            <div className="sticky top-6 space-y-6">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-400">upload_file</span>
                        <h3 className="text-lg font-semibold">Upload Documents</h3>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                        Drag & drop or upload supporting files. Gemini will extract data to auto-fill your valuation.
                    </p>
                </div>

                <div
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                        isDragging ? 'border-blue-400 bg-blue-500/10' : 'border-[#283339] bg-[#141b21]'
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
                        <span className="material-symbols-outlined text-3xl text-blue-400">cloud_upload</span>
                        <p className="text-sm font-semibold">
                            {fileName ? fileName : 'Drop files here'}
                        </p>
                        <p className="text-xs text-gray-400">CSV, XLS/XLSX, PDF</p>
                        <button
                            onClick={() => inputRef.current?.click()}
                            className="mt-3 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-500 hover:bg-blue-400 transition-colors"
                            disabled={status === 'loading'}
                            type="button"
                        >
                            Upload file
                        </button>
                    </div>
                </div>

                {status === 'loading' && (
                    <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-xs text-blue-200 space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                            <span>Uploading file...</span>
                        </div>
                        <p>Gemini is analyzing the document.</p>
                        <p>Processing and structuring the extracted data.</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-200">
                        {message}
                    </div>
                )}

                {status === 'error' && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200">
                        {message}
                    </div>
                )}

                <div className="text-[11px] text-gray-500 space-y-2">
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

                <div className="text-[11px] text-gray-500">
                    Supported formats: {SUPPORTED_EXTENSIONS.join(', ').toUpperCase()}
                </div>
            </div>
        </aside>
    );
};

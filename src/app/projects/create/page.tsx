import { Suspense } from 'react';
import { CreateProjectClient } from './create-project-client';

export default function CreateProjectPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 dark:bg-[#111618] flex items-center justify-center">
                <div className="text-slate-600 dark:text-white">Loading...</div>
            </div>
        }>
            <CreateProjectClient />
        </Suspense>
    );
}

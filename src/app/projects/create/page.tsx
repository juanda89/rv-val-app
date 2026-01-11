import { Suspense } from 'react';
import { CreateProjectClient } from './CreateProjectClient';

export default function CreateProjectPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#111618] flex items-center justify-center">
                <div className="text-white">Loading...</div>
            </div>
        }>
            <CreateProjectClient />
        </Suspense>
    );
}

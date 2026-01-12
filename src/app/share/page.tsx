export default function ShareReportMissingPage() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#111618] text-slate-900 dark:text-white flex items-center justify-center">
            <div className="text-center space-y-3">
                <h1 className="text-2xl font-bold">Report link missing</h1>
                <p className="text-sm text-slate-500 dark:text-gray-400">Please use a valid share link to access the valuation report.</p>
            </div>
        </div>
    );
}

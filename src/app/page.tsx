"use client";

import Link from 'next/link';
import { motion } from 'framer-motion';
import { FadeInStagger, FadeInStaggerItem } from '@/components/motion/FadeInStagger';
import { Inter } from 'next/font/google';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

const inter = Inter({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700', '800']
});

export default function LandingPage() {
    return (
        <div className={`bg-slate-50 dark:bg-[#101622] text-slate-900 dark:text-white min-h-screen flex flex-col overflow-x-hidden selection:bg-[#13a4ec]/30 transition-colors duration-200 ${inter.className}`}>
            {/* Top Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-[#101622]/70 backdrop-blur-md border-b border-slate-200 dark:border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="size-8 text-[#13a4ec]">
                            <span className="material-symbols-outlined text-4xl">analytics</span>
                        </div>
                        <h2 className="text-slate-900 dark:text-white text-xl font-bold tracking-tight">RV Valuator</h2>
                    </div>
                    <div className="hidden md:flex items-center gap-8">
                        <a className="text-sm font-medium text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors" href="#features">Features</a>
                        <a className="text-sm font-medium text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors" href="#pricing">Pricing</a>
                        <a className="text-sm font-medium text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors" href="#resources">Resources</a>
                    </div>
                    <div className="flex items-center gap-4">
                        <ThemeToggle className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors" />
                        <Link className="hidden sm:block text-sm font-medium text-slate-700 dark:text-white hover:text-[#13a4ec] transition-colors" href="/login">Sign In</Link>
                        <motion.button
                            className="bg-[#13a4ec] hover:bg-[#0f8bc7] text-white text-sm font-bold py-2.5 px-5 rounded-full transition-all shadow-[0_0_10px_rgba(19,164,236,0.2)] hover:shadow-[0_0_20px_rgba(19,164,236,0.3)] flex items-center gap-2"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            type="button"
                        >
                            <span>Book Demo</span>
                            <span className="material-symbols-outlined text-base">arrow_forward</span>
                        </motion.button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section
                className="relative pt-32 pb-20 px-6 bg-[radial-gradient(circle_at_50%_0%,rgba(19,164,236,0.12)_0%,rgba(248,250,252,0)_60%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(19,164,236,0.15)_0%,rgba(16,22,34,0)_60%)]"
            >
                <div className="max-w-5xl mx-auto text-center flex flex-col items-center">
                    <FadeInStagger className="flex flex-col items-center">
                        <FadeInStaggerItem>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#13a4ec]/10 border border-[#13a4ec]/20 text-[#13a4ec] text-xs font-semibold uppercase tracking-wider mb-8">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#13a4ec] opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#13a4ec]"></span>
                                </span>
                                v2.0 Now Live
                            </div>
                        </FadeInStaggerItem>
                        <FadeInStaggerItem>
                            <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-slate-900 to-slate-600 dark:from-white dark:to-white/70">
                                Precision Valuation for<br className="hidden md:block" /> RV Parks. Powered by Data.
                            </h1>
                        </FadeInStaggerItem>
                        <FadeInStaggerItem>
                            <p className="text-lg md:text-xl text-slate-600 dark:text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
                                Institutional-grade analytics for the modern campground investor. Underwrite deals in minutes, not days, with real-time market comps.
                            </p>
                        </FadeInStaggerItem>
                        <FadeInStaggerItem>
                            <div className="flex flex-col sm:flex-row gap-4 w-full justify-center mb-20">
                                <motion.button
                                    className="h-12 px-8 rounded-lg bg-[#13a4ec] text-white font-bold text-base hover:bg-[#0f8bc7] transition-all shadow-[0_0_20px_rgba(19,164,236,0.3)] flex items-center justify-center gap-2"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    type="button"
                                >
                                    Book a Live Demo
                                </motion.button>
                                <motion.button
                                    className="h-12 px-8 rounded-lg bg-white dark:bg-[#1c2930] border border-slate-200 dark:border-[#2a3b45] text-slate-900 dark:text-white font-semibold text-base hover:bg-slate-50 dark:hover:bg-[#23333d] hover:border-[#13a4ec]/50 transition-all flex items-center justify-center gap-2"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    type="button"
                                >
                                    <span className="material-symbols-outlined">description</span>
                                    See Sample Report
                                </motion.button>
                            </div>
                        </FadeInStaggerItem>
                    </FadeInStagger>

                    <div className="w-full max-w-6xl mx-auto px-4">
                        <div className="relative rounded-xl border border-[#2a3b45] bg-[#151f28] overflow-hidden shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] transition-transform duration-500 hover:scale-[1.01]">
                            <div className="absolute inset-0 bg-gradient-to-t from-[#101622] via-transparent to-transparent z-10 opacity-60"></div>
                            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#13a4ec]/50 to-transparent z-20"></div>
                            <div className="w-full aspect-[16/9] bg-[#1c2930] relative">
                                <div className="h-12 border-b border-[#2a3b45] flex items-center px-6 gap-4">
                                    <div className="w-32 h-3 bg-[#2a3b45]/50 rounded-full"></div>
                                    <div className="flex-1"></div>
                                    <div className="w-8 h-8 rounded-full bg-[#2a3b45]/50"></div>
                                </div>
                                <div className="p-6 grid grid-cols-12 gap-6 h-[calc(100%-3rem)]">
                                    <div className="col-span-3 bg-[#101622]/50 rounded border border-[#2a3b45]/30 h-full"></div>
                                    <div className="col-span-6 flex flex-col gap-6">
                                        <div className="h-64 bg-[#101622]/50 rounded border border-[#2a3b45]/30 relative overflow-hidden">
                                            <svg className="absolute bottom-0 left-0 w-full h-full text-[#13a4ec] opacity-20" preserveAspectRatio="none" viewBox="0 0 100 100">
                                                <path d="M0 100 L 10 80 L 30 85 L 50 40 L 70 60 L 90 20 L 100 10 V 100 Z" fill="currentColor"></path>
                                            </svg>
                                        </div>
                                        <div className="flex-1 bg-[#101622]/50 rounded border border-[#2a3b45]/30"></div>
                                    </div>
                                    <div className="col-span-3 flex flex-col gap-6">
                                        <div className="h-32 bg-[#101622]/50 rounded border border-[#2a3b45]/30"></div>
                                        <div className="flex-1 bg-[#101622]/50 rounded border border-[#2a3b45]/30"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Social Proof */}
            <section className="py-10 border-y border-slate-200 dark:border-[#2a3b45] bg-white dark:bg-[#0d121b]">
                <div className="max-w-7xl mx-auto px-6 text-center">
                    <p className="text-sm font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-8">Trusted by top real estate funds</p>
                    <div className="flex flex-wrap justify-center items-center gap-12 md:gap-20 opacity-60 grayscale text-slate-600 dark:text-gray-400">
                        {['APEX FUND', 'HORIZON', 'STONEGATE', 'VENTURE', 'OAKWOOD'].map((name, index) => (
                            <div key={name} className="h-8 flex items-center gap-2">
                                <span className="material-symbols-outlined text-3xl">apartment</span>
                                <span className="font-bold text-lg">{name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Bento Grid */}
            <section className="py-24 px-6 relative" id="features">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Analytics Suite</h2>
                        <p className="text-slate-600 dark:text-gray-400 text-lg max-w-2xl">Everything you need to evaluate parks with confidence, all in one dashboard.</p>
                    </div>
                    <FadeInStagger className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            { icon: 'monitoring', title: 'Instant P&L', body: 'Generate comprehensive financials instantly based on historical performance and predictive revenue models.' },
                            { icon: 'calculate', title: 'Predictive Tax', body: 'Forecast future liabilities with precision. Our engine accounts for local millage rates and reassessment risks.' },
                            { icon: 'map', title: 'Hyper-Local Comps', body: 'Analyze comparable parks in the exact vicinity. Filter by amenities, size, and current occupancy rates.' }
                        ].map((card) => (
                            <FadeInStaggerItem key={card.title}>
                                <div className="group relative bg-white dark:bg-[#1c2930] border border-slate-200 dark:border-[#2a3b45] rounded-xl p-8 hover:border-[#13a4ec]/40 transition-all duration-300 hover:-translate-y-1 shadow-sm">
                                    <div className="absolute inset-0 bg-gradient-to-br from-[#13a4ec]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"></div>
                                    <div className="relative z-10">
                                        <div className="w-12 h-12 rounded-lg bg-[#13a4ec]/10 flex items-center justify-center text-[#13a4ec] mb-6">
                                            <span className="material-symbols-outlined text-2xl">{card.icon}</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{card.title}</h3>
                                        <p className="text-slate-600 dark:text-gray-400 text-sm leading-relaxed">{card.body}</p>
                                    </div>
                                </div>
                            </FadeInStaggerItem>
                        ))}
                    </FadeInStagger>
                </div>
            </section>

            {/* Deep Dive / The Sheets Engine */}
            <section className="py-24 px-6 bg-slate-100 dark:bg-[#0c111a]" id="resources">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
                    <div className="w-full md:w-1/2">
                        <div className="inline-block px-3 py-1 rounded bg-slate-200 dark:bg-[#2a3b45]/30 text-[#13a4ec] text-xs font-mono mb-6">./engine_v2.0</div>
                        <h2 className="text-3xl md:text-5xl font-bold mb-6">The Sheets Engine™</h2>
                        <p className="text-slate-600 dark:text-gray-400 text-lg leading-relaxed mb-8">
                            Transition from messy spreadsheets to structured data without losing the flexibility you love. Our engine ingests raw Excel data and transforms it into interactive, visual dashboards instantly.
                        </p>
                        <ul className="space-y-4 mb-8">
                            {['Automatic rent roll parsing', 'Standardized expense categorization', 'Export to PDF, Excel, or shareable link'].map((item) => (
                                <li key={item} className="flex items-center gap-3 text-sm text-slate-600 dark:text-gray-300">
                                    <span className="material-symbols-outlined text-[#13a4ec]">check_circle</span>
                                    {item}
                                </li>
                            ))}
                        </ul>
                        <button className="text-slate-900 dark:text-white border-b border-[#13a4ec] pb-1 hover:text-[#13a4ec] transition-colors flex items-center gap-2">
                            Learn about our API <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </button>
                    </div>
                    <div className="w-full md:w-1/2">
                        <div className="relative w-full aspect-square md:aspect-[4/3] bg-white dark:bg-[#1c2930] border border-slate-200 dark:border-[#2a3b45] rounded-2xl overflow-hidden p-8 flex items-center justify-center shadow-sm">
                            <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/cubes.png')" }}></div>
                            <div className="relative z-10 w-full max-w-sm">
                                <div className="bg-white/80 dark:bg-white/5 backdrop-blur border border-slate-200 dark:border-white/10 rounded-lg p-4 mb-4 transform -rotate-6 transition-transform hover:rotate-0 duration-500 origin-bottom-left shadow-lg">
                                    <div className="grid grid-cols-4 gap-2 mb-2">
                                        {Array.from({ length: 4 }).map((_, idx) => (
                                            <div key={idx} className="h-2 bg-slate-200 dark:bg-white/10 rounded col-span-1"></div>
                                        ))}
                                    </div>
                                    <div className="space-y-2">
                                        {Array.from({ length: 3 }).map((_, idx) => (
                                            <div key={idx} className="h-1 bg-slate-200/60 dark:bg-white/5 rounded w-full"></div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex justify-center my-2">
                                    <span className="material-symbols-outlined text-[#13a4ec] text-3xl animate-bounce">arrow_downward</span>
                                </div>
                                <div className="bg-slate-900 dark:bg-[#101622] border border-[#13a4ec]/50 rounded-lg p-4 shadow-[0_0_30px_rgba(19,164,236,0.15)] transform rotate-2 transition-transform hover:rotate-0 duration-500 origin-top-right">
                                    <div className="flex justify-between items-end mb-4">
                                        <div className="w-16 h-16 rounded-full border-4 border-[#13a4ec]/20 border-t-[#13a4ec] flex items-center justify-center">
                                            <span className="text-xs font-bold text-white">98%</span>
                                        </div>
                                        <div className="space-y-1 text-right">
                                            <div className="h-2 w-12 bg-[#13a4ec] ml-auto rounded"></div>
                                            <div className="h-1 w-8 bg-gray-600 ml-auto rounded"></div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {Array.from({ length: 3 }).map((_, idx) => (
                                            <div key={idx} className="h-8 bg-[#13a4ec]/10 rounded border border-[#13a4ec]/20"></div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing */}
            <section className="py-24 px-6 relative overflow-hidden" id="pricing">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#13a4ec]/5 rounded-full blur-3xl pointer-events-none"></div>
                <div className="max-w-7xl mx-auto relative z-10">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, transparent pricing</h2>
                        <p className="text-slate-600 dark:text-gray-400">Choose the plan that fits your investment volume.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto items-center">
                        {['Starter', 'Growth', 'Enterprise'].map((tier) => (
                            <div
                                key={tier}
                                className={`rounded-xl p-8 ${tier === 'Growth' ? 'bg-white dark:bg-[#1c2930] border border-[#13a4ec]/50 shadow-[0_0_20px_rgba(19,164,236,0.3)]' : 'bg-white/80 dark:bg-[#1c2930]/50 border border-slate-200 dark:border-[#2a3b45]'} shadow-sm`}
                            >
                                {tier === 'Growth' && (
                                    <div className="-mt-10 mb-4 inline-block bg-[#13a4ec] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">Most Popular</div>
                                )}
                                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">{tier}</h3>
                                <div className="flex items-baseline gap-1 mb-6">
                                    <span className="text-3xl font-bold">{tier === 'Starter' ? '$99' : tier === 'Growth' ? '$249' : 'Custom'}</span>
                                    {tier !== 'Enterprise' && <span className="text-slate-500 dark:text-gray-400">/mo</span>}
                                </div>
                                <p className="text-sm text-slate-600 dark:text-gray-400 mb-8">
                                    {tier === 'Starter'
                                        ? 'For individual investors looking at occasional deals.'
                                        : tier === 'Growth'
                                            ? 'For active funds and syndicators scaling up.'
                                            : 'For large institutions requiring API access.'}
                                </p>
                                <button className={`w-full py-2.5 rounded-lg font-medium transition-colors mb-8 ${tier === 'Growth' ? 'bg-[#13a4ec] hover:bg-[#0f8bc7] text-white font-bold shadow-lg shadow-[#13a4ec]/20' : 'border border-slate-200 dark:border-[#2a3b45] hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-white'}`}>
                                    {tier === 'Enterprise' ? 'Contact Sales' : tier === 'Growth' ? 'Get Started' : 'Start Free Trial'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="py-24 px-6 bg-white dark:bg-[#0d121b]">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-3xl font-bold mb-12 text-center">Frequently asked questions</h2>
                    <div className="space-y-4">
                        {[
                            { q: 'Where do you source your data?', a: 'We aggregate data from over 50 public and private sources, including county tax records, reservation systems, and proprietary partnerships with major campground management software providers.' },
                            { q: 'Can I customize the valuation parameters?', a: 'Absolutely. While our system provides defaults based on market averages, you can override cap rates, expense ratios, and occupancy projections to match your specific underwriting criteria.' },
                            { q: 'Is there a free trial available?', a: 'Yes, we offer a 7-day free trial on the Starter and Growth plans so you can test drive the platform and run your first few reports at no cost.' }
                        ].map((faq) => (
                            <details key={faq.q} className="group bg-white dark:bg-[#1c2930] rounded-lg border border-slate-200 dark:border-[#2a3b45] overflow-hidden shadow-sm">
                                <summary className="flex justify-between items-center font-medium cursor-pointer list-none p-6 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                    <span>{faq.q}</span>
                                    <span className="transition group-open:rotate-180">
                                        <span className="material-symbols-outlined">expand_more</span>
                                    </span>
                                </summary>
                                <div className="text-slate-600 dark:text-gray-400 px-6 pb-6 text-sm leading-relaxed">
                                    {faq.a}
                                </div>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-32 px-6 relative overflow-hidden flex flex-col items-center justify-center text-center">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-[#101622] dark:via-[#0d2a3d] dark:to-[#101622]"></div>
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#13a4ec]/10 via-transparent to-transparent opacity-50"></div>
                <div className="relative z-10 max-w-4xl">
                    <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">Ready to underwrite your next park?</h2>
                    <p className="text-xl text-slate-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto">Join 500+ investors using RV Valuator to make data-driven decisions.</p>
                    <motion.button
                        className="h-14 px-10 rounded-full bg-[#13a4ec] text-white text-lg font-bold hover:bg-[#0f8bc7] transition-all shadow-[0_0_20px_rgba(19,164,236,0.3)]"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                    >
                        Book a Live Demo
                    </motion.button>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-white dark:bg-[#101622] border-t border-slate-200 dark:border-[#2a3b45] pt-16 pb-8 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                        <div className="col-span-1">
                            <div className="flex items-center gap-2 mb-6">
                                <span className="material-symbols-outlined text-[#13a4ec] text-2xl">analytics</span>
                                <span className="text-lg font-bold">RV Valuator</span>
                            </div>
                            <p className="text-slate-600 dark:text-gray-400 text-sm mb-6">The standard for RV park valuation and analytics.</p>
                            <div className="flex gap-4">
                                <a className="text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white" href="#"><span className="material-symbols-outlined text-xl">work</span></a>
                                <a className="text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white" href="#"><span className="material-symbols-outlined text-xl">alternate_email</span></a>
                            </div>
                        </div>
                        {['Product', 'Company', 'Legal'].map((title) => (
                            <div key={title}>
                                <h4 className="font-bold mb-6">{title}</h4>
                                <ul className="space-y-4 text-sm text-slate-600 dark:text-gray-400">
                                    {['Features', 'Pricing', 'API', 'Case Studies'].map((item) => (
                                        <li key={`${title}-${item}`}>
                                            <a className="hover:text-[#13a4ec] transition-colors" href="#">{item}</a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                    <div className="border-t border-slate-200 dark:border-[#2a3b45] pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-slate-500 dark:text-gray-400">
                        <p>© 2023 RV Valuator Inc. All rights reserved.</p>
                        <div className="flex items-center gap-2 mt-4 md:mt-0">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            Systems Operational
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}

"use client";

import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { BarChart3, Lock, Mail } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleGoogleLogin = async () => {
        setLoading(true);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
        if (error) {
            console.error('Error logging in:', error.message);
            setLoading(false);
        }
    };

    // Note: Manual email/pass login logic omitted as per instructions "solo gmail", 
    // but UI is kept as per design.

    return (
        <div className="flex flex-1 w-full h-full min-h-screen bg-[#101c22]">
            {/* Left Section: Visual/Brand (Desktop only) */}
            <div className="hidden lg:flex lg:w-1/2 relative bg-[#1c262c] overflow-hidden flex-col justify-between p-12">
                {/* Background Image with Overlay */}
                <div className="absolute inset-0 z-0">
                    <img
                        alt="Aerial view"
                        className="w-full h-full object-cover opacity-40 mix-blend-overlay"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuBGIEUYDAl9ucR84MfSe7TBX27549L3JH_O1SWocLuj2vmHQ-QmdL6MaqyLvk_RRmwLKsKV6HgdFnQMhJ62c47NS1uC_OjqPDKr9xlrU66bpLl5GUpsQdnGbLEWmlHhlaMRuYhsrGUkjFiqUFNgfxg6vKfkSNqRB2oC_woAmcEcWEq2ERBntCxaITBmaYvEqSTCTyDAb27GOqhSXcCXjtki_Gxb1p9fgNBhLuTR_hRDVLZFuQNDtUyndrC3eNhCPisB12RVR0cjEm0"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#101c22] via-[#101c22]/80 to-[#13a4ec]/20 mix-blend-multiply"></div>
                    {/* Abstract topographic lines effect */}
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#13a4ec 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
                </div>

                {/* Brand Logo (Top Left) */}
                <div className="relative z-10 flex items-center gap-3 text-white">
                    <div className="size-10 flex items-center justify-center rounded-lg bg-[#13a4ec]/20 text-[#13a4ec] border border-[#13a4ec]/30">
                        <BarChart3 className="w-6 h-6 text-[#13a4ec]" />
                    </div>
                    <h2 className="text-white text-2xl font-bold tracking-tight">ParkValuate</h2>
                </div>

                {/* Hero Text (Bottom Left) */}
                <div className="relative z-10 max-w-lg">
                    <blockquote className="text-2xl font-medium text-white leading-relaxed mb-6">
                        "This platform transformed how we evaluate our park acquisitions. The data precision is unmatched in the industry."
                    </blockquote>
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-slate-700 overflow-hidden border border-slate-600">
                            <img alt="User" className="h-full w-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAU5lP0xzg53GTGYysGjoDu994g8HkP4-LQ2U3mcVVM9s9GUqv_qzTJHbhWSFXUBKJre0phOKb3nkMijOE6TGruHjGA5OVAkkOD3bF-9YSAzl618JLUIPBwx2UN2v41KMzG4txznNvlFZJRN4o-JJ6-XE8ANNRiJjmUhuY7wL_KjXwm7AGIDaDvuYXIYpjoaGypzpc-5O_ttP8UtfqYnnx10bvANGCEFB5EmsIPGpDtz1Z8oFGqITi9tydfF0fvecSr8G0RX9KW1oc" />
                        </div>
                        <div>
                            <p className="text-white font-semibold">David Miller</p>
                            <p className="text-slate-400 text-sm">Managing Partner, Horizon Resorts</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Section: Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative bg-[#101c22]">
                <div className="w-full max-w-[420px] flex flex-col gap-8">
                    {/* Header Section */}
                    <div className="flex flex-col gap-2 text-center lg:text-left">
                        <h1 className="text-white text-3xl md:text-4xl font-bold tracking-tight">Welcome Back</h1>
                        <p className="text-slate-400 text-base">
                            Enter your credentials to access real-time analytics.
                        </p>
                    </div>

                    {/* Google Login Button (Primary Action) */}
                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="flex items-center justify-center gap-3 h-12 bg-white text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-all active:scale-[0.98] w-full"
                    >
                        {loading ? "Connecting..." : (
                            <>
                                <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                                <span>Continue with Google</span>
                            </>
                        )}
                    </button>

                    <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-700"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="bg-[#101c22] px-2 text-slate-500">Or sign in with email</span>
                        </div>
                    </div>

                    {/* Form Section (Visual Only for now) */}
                    <form className="flex flex-col gap-5 opacity-60 pointer-events-none">
                        <div className="flex flex-col gap-2">
                            <label className="text-slate-200 text-sm font-medium" htmlFor="email">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                <input className="w-full h-12 rounded-lg bg-[#1c262c] border border-slate-700 text-white pl-11 pr-4 placeholder-slate-500" id="email" placeholder="name@company.com" type="email" />
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-slate-200 text-sm font-medium" htmlFor="password">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                <input className="w-full h-12 rounded-lg bg-[#1c262c] border border-slate-700 text-white pl-11 pr-12 placeholder-slate-500" id="password" placeholder="Enter your password" type="password" />
                            </div>
                        </div>
                        <button className="w-full h-12 mt-2 bg-[#13a4ec] text-white font-semibold rounded-lg shadow-lg shadow-[#13a4ec]/20" type="button">
                            Sign In
                        </button>
                    </form>

                </div>
            </div>
        </div>
    );
}

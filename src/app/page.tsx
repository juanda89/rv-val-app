"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// Helper for formatting date
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [dateSort, setDateSort] = useState('newest');
  const [layout, setLayout] = useState<'table' | 'grid'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const hasMapsKey = Boolean(
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY &&
    !process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY.includes('placeholder')
  );
  const pageSize = 25;

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'NA';
    const first = parts[0]?.[0] || '';
    const second = parts.length > 1 ? parts[1]?.[0] || '' : parts[0]?.[1] || '';
    return `${first}${second}`.toUpperCase();
  };

  const colorPalette = ['#0f766e', '#1d4ed8', '#7c2d12', '#166534', '#7c3aed', '#b91c1c'];
  const getAvatarColor = (seed: string) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    const index = Math.abs(hash) % colorPalette.length;
    return colorPalette[index];
  };

  const getMapUrl = (address?: string) => {
    if (!hasMapsKey || !address) return '';
    const encodedAddress = encodeURIComponent(address);
    return `https://maps.googleapis.com/maps/api/staticmap?center=${encodedAddress}&zoom=15&size=160x160&maptype=roadmap&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`;
  };

  const getLocationParts = (address?: string) => {
    if (!address) return { city: '', state: '', country: '' };
    const parts = address
      .split(',')
      .map(part => part.trim())
      .filter(Boolean);

    if (parts.length >= 3) {
      const country = parts[parts.length - 1] || '';
      const state = parts[parts.length - 2] || '';
      const city = parts[parts.length - 3] || '';
      return { city, state, country };
    }

    if (parts.length === 2) {
      return { city: parts[0] || '', state: parts[1] || '', country: '' };
    }

    return { city: parts[0] || '', state: '', country: '' };
  };

  const formatLocation = (address?: string) => {
    const { city, state, country } = getLocationParts(address);
    const trailing = [state, country].filter(Boolean).join(', ');
    const formatted = [city, trailing].filter(Boolean).join(' · ');
    return formatted || 'Unknown';
  };

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
      } else {
        setUser(session.user);
        fetchProjects();
      }
    };
    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push('/login');
      else setUser(session.user);
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const fetchProjects = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) console.error('Error fetching projects:', error);
    else setProjects(data || []);

    setLoading(false);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, locationFilter, dateSort]);

  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const normalized = projects.filter(project => {
      const name = (project.name || '').toLowerCase();
      const address = (project.address || '').toLowerCase();
      const { city } = getLocationParts(project.address || '');
      const cityValue = city.toLowerCase();

      const matchesQuery = !query || name.includes(query) || address.includes(query) || cityValue.includes(query);
      const statusValue = (project.status || 'active').toLowerCase();
      const matchesStatus = statusFilter === 'all' || statusValue === statusFilter;
      const matchesLocation = locationFilter === 'all' || city === locationFilter;

      return matchesQuery && matchesStatus && matchesLocation;
    });

    const sorted = normalized.slice().sort((a, b) => {
      const aDate = new Date(a.created_at).getTime();
      const bDate = new Date(b.created_at).getTime();
      return dateSort === 'oldest' ? aDate - bDate : bDate - aDate;
    });

    return sorted;
  }, [projects, searchQuery, statusFilter, locationFilter, dateSort]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / pageSize));
  const paginatedProjects = filteredProjects.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const locationOptions = useMemo(() => {
    const citySet = new Set<string>();
    projects.forEach(project => {
      const { city } = getLocationParts(project.address || '');
      if (city) citySet.add(city);
    });
    return Array.from(citySet).sort((a, b) => a.localeCompare(b));
  }, [projects]);

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Delete this valuation? This will remove the Drive file and the project record.')) return;
    setDeletingId(projectId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/projects/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ projectId })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Delete failed');
      }

      setProjects(prev => prev.filter(project => project.id !== projectId));
    } catch (error: any) {
      console.error('Delete failed:', error);
      alert(error.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#101c22] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-[#13a4ec] animate-spin text-4xl">progress_activity</span>
          <p className="text-slate-400">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#f6f7f8] dark:bg-[#101c22] text-slate-900 dark:text-white font-sans min-h-screen flex flex-col overflow-x-hidden">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 flex items-center justify-between whitespace-nowrap border-b border-solid border-[#e5e7eb] dark:border-[#283339] bg-white dark:bg-[#101c22] px-6 py-3 lg:px-10">
        <Link href="/" className="flex items-center gap-4 text-slate-900 dark:text-white hover:opacity-90">
          <div className="size-8 flex items-center justify-center bg-[#13a4ec]/20 rounded-lg text-[#13a4ec]">
            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>analytics</span>
          </div>
          <h2 className="text-lg font-bold leading-tight tracking-[-0.015em]">RV Valuations</h2>
        </Link>
        {/* Desktop Nav Links */}
        <div className="hidden md:flex flex-1 justify-end gap-8">
          <nav className="flex items-center gap-6 lg:gap-9">
            <Link className="text-[#13a4ec] text-sm font-medium leading-normal" href="/">Valuations</Link>
          </nav>
          <div className="flex items-center gap-3 pl-4 border-l border-[#e5e7eb] dark:border-[#283339]">
            <div className="flex flex-col items-end hidden lg:flex">
              <span className="text-xs font-semibold">{user.email?.split('@')[0]}</span>
              <span className="text-[10px] text-slate-500">Analyst</span>
            </div>
            <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 ring-2 ring-[#13a4ec]/20" style={{ backgroundImage: `url("${user.user_metadata?.avatar_url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuCfiRrmsH38PFbM3aPEy653MqJHkxb_dtUwGa1EkqeNY6U1BoaGt-Xn1pryFa7cZbAYVCTiESpF99VlU8eYXkQdGBTUU5xHCKGwaKPBtiO9VyffyCKfMYI1_gIWTwJvrkCsa68f3b7kggrkoxlscfK20s_9VPx--WU5ULSksu69ZmQD5YE874GCQxRer_MTLm8U654wvMPHc3ZcmF5o7pNT1e8vbNCfhOrwDcT7HgominJ-J5jozoeFinIsyKaBxXLS819EIHEh80M'}")` }}></div>
            <button onClick={() => supabase.auth.signOut()} className="text-xs text-red-400 hover:text-red-300 ml-2">Sign Out</button>
          </div>
        </div>
        {/* Mobile Menu Icon */}
        <div className="flex md:hidden">
          <button className="p-2 text-slate-900 dark:text-white">
            <span className="material-symbols-outlined">menu</span>
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
        {/* Page Heading & Actions */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl sm:text-4xl font-black leading-tight tracking-[-0.033em]">Valuations & Analytics</h1>
            <p className="text-slate-500 dark:text-[#9db0b9] text-base font-normal">Manage your property valuations and review past performance analytics.</p>
          </div>
          <Link href="/projects/create">
            <button className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#13a4ec] hover:bg-sky-500 text-white rounded-lg shadow-lg shadow-[#13a4ec]/20 transition-all active:scale-95 group">
              <span className="material-symbols-outlined font-bold group-hover:rotate-90 transition-transform">add</span>
              <span className="font-bold text-sm">+ New Valuation</span>
            </button>
          </Link>
        </div>

        {/* Stats Grid - Static for demo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex flex-col gap-2 rounded-xl p-5 bg-white dark:bg-[#1c2930] border border-[#e5e7eb] dark:border-[#283339] shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <span className="material-symbols-outlined text-[#13a4ec]" style={{ fontSize: '20px' }}>folder_open</span>
              <p className="text-sm font-medium">Total Valuations</p>
            </div>
            <p className="text-3xl font-bold tracking-tight">{projects.length}</p>
            <p className="text-xs text-green-500 font-medium flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>trending_up</span>
              +2 this month
            </p>
          </div>
          {/* ... other stats omitted for brevity / static content */}
        </div>

        {/* Pending Reports */}
        <div className="rounded-2xl border border-[#e5e7eb] dark:border-[#283339] bg-white dark:bg-[#1c2930] p-6 shadow-sm">
          <div className="flex items-center gap-3 text-slate-900 dark:text-white">
            <span className="material-symbols-outlined text-[#13a4ec]">pending_actions</span>
            <h3 className="text-lg font-bold">Pending Reports</h3>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[#e5e7eb] dark:border-[#283339] p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '16px' }}>percent</span>
                  Average Cap Rate
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">--</p>
              </div>
              <span className="material-symbols-outlined text-slate-300 dark:text-slate-600">analytics</span>
            </div>
            <div className="rounded-xl border border-[#e5e7eb] dark:border-[#283339] p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '16px' }}>account_balance</span>
                  Total Asset Value
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">--</p>
              </div>
              <span className="material-symbols-outlined text-slate-300 dark:text-slate-600">paid</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-[#e5e7eb] dark:border-[#283339] bg-white dark:bg-[#1c2930] p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#13a4ec]">tune</span>
                <h3 className="text-lg font-bold">Filters</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLayout('table')}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border ${layout === 'table' ? 'bg-[#13a4ec] text-white border-[#13a4ec]' : 'border-[#e5e7eb] dark:border-[#283339] text-slate-500 dark:text-slate-400'}`}
                >
                  <span className="material-symbols-outlined text-sm align-middle mr-1">table_rows</span>
                  Table
                </button>
                <button
                  onClick={() => setLayout('grid')}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border ${layout === 'grid' ? 'bg-[#13a4ec] text-white border-[#13a4ec]' : 'border-[#e5e7eb] dark:border-[#283339] text-slate-500 dark:text-slate-400'}`}
                >
                  <span className="material-symbols-outlined text-sm align-middle mr-1">grid_view</span>
                  Grid
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-2">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '16px' }}>search</span>
                  Search by name or city
                </label>
                <input
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  placeholder="Search valuations..."
                  className="w-full rounded-lg border border-[#e5e7eb] dark:border-[#283339] bg-transparent px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#13a4ec]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '16px' }}>flag</span>
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={event => setStatusFilter(event.target.value)}
                  className="w-full rounded-lg border border-[#e5e7eb] dark:border-[#283339] bg-transparent px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#13a4ec]"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '16px' }}>location_on</span>
                  Location
                </label>
                <select
                  value={locationFilter}
                  onChange={event => setLocationFilter(event.target.value)}
                  className="w-full rounded-lg border border-[#e5e7eb] dark:border-[#283339] bg-transparent px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#13a4ec]"
                >
                  <option value="all">All</option>
                  {locationOptions.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '16px' }}>calendar_month</span>
                  Date
                </label>
                <select
                  value={dateSort}
                  onChange={event => setDateSort(event.target.value)}
                  className="w-full rounded-lg border border-[#e5e7eb] dark:border-[#283339] bg-transparent px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#13a4ec]"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Data Display */}
        <div className="rounded-xl border border-[#e5e7eb] dark:border-[#283339] bg-white dark:bg-[#1c2930] shadow-sm">
          {layout === 'table' ? (
            <div className="overflow-hidden">
              <table className="w-full table-fixed text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#e5e7eb] dark:border-[#283339] bg-slate-50 dark:bg-[#152026]">
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[28%]">
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '16px' }}>domain</span>
                        Park Name
                      </span>
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[18%]">
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '16px' }}>location_on</span>
                        Location
                      </span>
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[14%]">
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '16px' }}>calendar_month</span>
                        Date Created
                      </span>
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[12%]">
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '16px' }}>paid</span>
                        Valuation
                      </span>
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[10%]">
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '16px' }}>percent</span>
                        Cap Rate
                      </span>
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[10%]">
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '16px' }}>check_circle</span>
                        Status
                      </span>
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right w-[8%]">
                      <span className="flex items-center justify-end gap-2">
                        <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '16px' }}>more_vert</span>
                        Actions
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e7eb] dark:divide-[#283339]">
                  {loading && (
                    <tr><td colSpan={7} className="text-center p-8 text-gray-500">Loading projects...</td></tr>
                  )}
                  {!loading && filteredProjects.length === 0 && (
                    <tr><td colSpan={7} className="text-center p-8 text-gray-500">No projects found. Create one!</td></tr>
                  )}
                  {paginatedProjects.map((project) => (
                    <tr
                      key={project.id}
                      className="group hover:bg-slate-50 dark:hover:bg-[#1a262d] transition-colors cursor-pointer"
                      onClick={() => router.push(`/projects/create?projectId=${project.id}`)}
                    >
                      <td className="px-6 py-4 align-top">
                        <div className="flex items-center gap-3">
                          {(() => {
                            const mapUrl = getMapUrl(project.address);
                            const initials = getInitials(project.name || 'NA');
                            const fallbackColor = getAvatarColor(project.name || project.id);
                            return (
                              <div
                                className="size-10 rounded-lg bg-cover bg-center shrink-0 border border-[#e5e7eb] dark:border-[#283339] flex items-center justify-center"
                                style={
                                  mapUrl
                                    ? { backgroundImage: `url("${mapUrl}")` }
                                    : { backgroundColor: fallbackColor }
                                }
                              >
                                {!mapUrl && <span className="text-xs font-bold text-white">{initials}</span>}
                              </div>
                            );
                          })()}
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#13a4ec] transition-colors break-words">{project.name}</p>
                            <p className="text-xs text-slate-500">ID: #{project.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '16px' }}>location_on</span>
                          <span className="text-sm text-slate-700 dark:text-slate-300 break-words">{formatLocation(project.address)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top text-sm text-slate-600 dark:text-slate-400">{formatDate(project.created_at)}</td>
                      <td className="px-6 py-4 align-top">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">--</span>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">--</span>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                          <span className="size-1.5 rounded-full bg-emerald-500"></span>
                          {project.status || 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-4 align-top text-right">
                        <div className="relative inline-flex" onClick={event => event.stopPropagation()}>
                          <button
                            className="text-slate-400 hover:text-[#13a4ec] transition-colors p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-[#283339]"
                            onClick={() => setOpenMenuId(prev => (prev === project.id ? null : project.id))}
                            aria-label="Project actions"
                          >
                            <span className="material-symbols-outlined">more_vert</span>
                          </button>
                          {openMenuId === project.id && (
                            <div className="absolute right-0 mt-2 w-36 rounded-lg border border-[#e5e7eb] dark:border-[#283339] bg-white dark:bg-[#1c2930] shadow-lg z-10">
                              <button
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenMenuId(null);
                                  handleDeleteProject(project.id);
                                }}
                                disabled={deletingId === project.id}
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6">
              {filteredProjects.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No projects found. Create one!</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {paginatedProjects.map(project => {
                    const mapUrl = getMapUrl(project.address);
                    const initials = getInitials(project.name || 'NA');
                    const fallbackColor = getAvatarColor(project.name || project.id);
                    return (
                      <div
                        key={project.id}
                        className="rounded-xl border border-[#e5e7eb] dark:border-[#283339] p-4 hover:bg-slate-50 dark:hover:bg-[#1a262d] transition-colors cursor-pointer"
                        onClick={() => router.push(`/projects/create?projectId=${project.id}`)}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="size-12 rounded-lg bg-cover bg-center shrink-0 border border-[#e5e7eb] dark:border-[#283339] flex items-center justify-center"
                            style={
                              mapUrl
                                ? { backgroundImage: `url("${mapUrl}")` }
                                : { backgroundColor: fallbackColor }
                            }
                          >
                            {!mapUrl && <span className="text-sm font-bold text-white">{initials}</span>}
                          </div>
                          <div className="min-w-0">
                            <p className="text-base font-bold text-slate-900 dark:text-white break-words">{project.name}</p>
                            <p className="text-xs text-slate-500">ID: #{project.id.slice(0, 8)}</p>
                          </div>
                        </div>
                        <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '16px' }}>location_on</span>
                            <span>{formatLocation(project.address)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '16px' }}>calendar_month</span>
                            <span>{formatDate(project.created_at)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '16px' }}>paid</span>
                            <span>--</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '16px' }}>percent</span>
                            <span>--</span>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                            <span className="size-1.5 rounded-full bg-emerald-500"></span>
                            {project.status || 'Active'}
                          </span>
                          <div className="relative" onClick={event => event.stopPropagation()}>
                            <button
                              className="text-slate-400 hover:text-[#13a4ec] transition-colors p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-[#283339]"
                              onClick={() => setOpenMenuId(prev => (prev === project.id ? null : project.id))}
                              aria-label="Project actions"
                            >
                              <span className="material-symbols-outlined">more_vert</span>
                            </button>
                            {openMenuId === project.id && (
                              <div className="absolute right-0 mt-2 w-36 rounded-lg border border-[#e5e7eb] dark:border-[#283339] bg-white dark:bg-[#1c2930] shadow-lg z-10">
                                <button
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setOpenMenuId(null);
                                    handleDeleteProject(project.id);
                                  }}
                                  disabled={deletingId === project.id}
                                >
                                  <span className="material-symbols-outlined text-sm">delete</span>
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div className="px-6 py-4 border-t border-[#e5e7eb] dark:border-[#283339] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Showing{' '}
              <span className="font-medium text-slate-900 dark:text-white">
                {filteredProjects.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              </span>{' '}
              to{' '}
              <span className="font-medium text-slate-900 dark:text-white">
                {Math.min(currentPage * pageSize, filteredProjects.length)}
              </span>{' '}
              of{' '}
              <span className="font-medium text-slate-900 dark:text-white">{filteredProjects.length}</span>{' '}
              results
            </p>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-2 rounded-lg border border-[#e5e7eb] dark:border-[#283339] text-xs font-semibold text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#283339] disabled:opacity-50"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Prev
              </button>
              <span className="text-xs text-slate-500 dark:text-slate-400">Page {currentPage} of {totalPages}</span>
              <button
                className="px-3 py-2 rounded-lg border border-[#e5e7eb] dark:border-[#283339] text-xs font-semibold text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#283339] disabled:opacity-50"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    UserCheck,
    CalendarCheck,
    AlertTriangle,
    Bell,
    CheckCircle2,
    Clock,
    ChevronRight,
    Zap,
    TrendingUp,
    FolderKanban,
    Mail,
    Phone,
    RefreshCw,
    Users,
    ExternalLink,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface MyDayData {
    role: 'Admin' | 'Lead' | 'Member';
    // Admin
    activeLeads?: any[];
    // Lead
    todayMeetings?: any[];
    // Member
    assignedToday?: any[];
    unassignedLeads?: any[];

    stats: any;
    notifications: any[];
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
    'New': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100' },
    'Contacted': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100' },
    'In Progress': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
    'Qualified': { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-100' },
    'Won': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
    'Lost': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-100' },
    'Closed': { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
};

export default function SalesDashboardPage() {
    const router = useRouter();
    const [data, setData] = useState<MyDayData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'info' | 'lead' | 'meeting'>('all');
    const [dismissedNotifs, setDismissedNotifs] = useState<number[]>([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/sales/my-day');
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (err) {
            console.error('Sales my-day error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <p className="text-sm font-semibold text-gray-400">Loading your dashboard...</p>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const now = new Date();
    const dayGreeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
    const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

    const visibleNotifs = (data.notifications || [])
        .filter(n => !dismissedNotifs.includes(n.id))
        .filter(n => activeTab === 'all' || n.type === activeTab);

    // Render Blocks based on Role
    const renderAdminDashboard = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
                <StatCard label="Total Assigned" value={data.stats.totalAssigned} icon={Users} color="text-blue-600" bg="bg-blue-50" />
                <StatCard label="Unassigned Leads" value={data.stats.unassigned} icon={AlertTriangle} color="text-amber-600" bg="bg-amber-50" />
                <StatCard label="Total Converted" value={data.stats.convertedLeads} icon={TrendingUp} color="text-emerald-600" bg="bg-emerald-50" />
            </div>
            <LeadList title="Recent Active Leads" leads={data.activeLeads || []} />
        </div>
    );

    const renderLeadDashboard = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <StatCard label="My Meetings Today" value={data.stats.meetingsToday} icon={CalendarCheck} color="text-purple-600" bg="bg-purple-50" />
            </div>
            {/* Meetings List */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-7 py-5 border-b border-gray-50 flex items-center gap-2">
                    <CalendarCheck className="h-5 w-5 text-purple-600" />
                    <div>
                        <h2 className="text-sm font-black text-gray-900">Meetings Today</h2>
                        <p className="text-xs text-gray-400 font-medium">{(data.todayMeetings || []).length} scheduled</p>
                    </div>
                </div>
                {(data.todayMeetings || []).length === 0 ? (
                    <div className="py-10 flex flex-col items-center gap-3">
                        <CalendarCheck className="h-10 w-10 text-gray-200" />
                        <p className="text-sm font-medium text-gray-400">No meetings scheduled for today</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {data.todayMeetings?.map((m: any) => (
                            <div key={m._id} className="px-7 py-4 flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <div className="h-9 w-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                                        <CalendarCheck className="h-4 w-4 text-purple-600" />
                                    </div>
                                    <div className="flex-1 pr-4">
                                        <p className="text-sm font-bold text-gray-900">{m.title}</p>
                                        <p className="text-xs text-gray-400 font-medium mt-0.5 mb-1">with {m.leadName}</p>
                                        {m.notes && (
                                            <div className="mt-2 bg-gray-50/50 rounded-lg p-2.5 border border-gray-100/50">
                                                <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                                                    {m.notes}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end gap-2.5 shrink-0">
                                    <p className="text-xs font-black text-purple-600 bg-purple-50 px-2.5 py-1 rounded-lg">
                                        {new Date(m.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                    {m.link && (
                                        <a
                                            href={m.link.startsWith('http') ? m.link : `https://${m.link}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 transition-colors shadow-sm cursor-pointer"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            Join Meeting
                                            <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    const renderMemberDashboard = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
                <StatCard label="Leads Today" value={data.stats.leadsToday} icon={UserCheck} color="text-blue-600" bg="bg-blue-50" />
                <StatCard label="Total Assigned" value={data.stats.totalAssigned} icon={FolderKanban} color="text-purple-600" bg="bg-purple-50" />
                <StatCard label="My Conversions" value={data.stats.convertedLeads} icon={TrendingUp} color="text-emerald-600" bg="bg-emerald-50" />
            </div>

            {/* Unassigned Ext Leads (from Webhook) */}
            {(data.unassignedLeads && data.unassignedLeads.length > 0) && (
                <div className="bg-amber-50 rounded-3xl border border-amber-100 overflow-hidden">
                    <div className="px-7 py-5 border-b border-amber-100 flex items-center gap-2">
                        <Zap className="h-5 w-5 text-amber-500" />
                        <div>
                            <h2 className="text-sm font-black text-amber-800">New Inbound Leads Pool</h2>
                            <p className="text-xs text-amber-600 font-medium">{data.unassignedLeads.length} leads waiting to be claimed</p>
                        </div>
                    </div>
                    <div className="divide-y divide-amber-100">
                        {data.unassignedLeads.slice(0, 3).map((lead: any) => (
                            <div key={lead._id} className="px-7 py-4 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold text-amber-900">{lead.firstName} {lead.lastName}</p>
                                    <p className="text-xs text-amber-600 font-medium">{lead.sourceType} Lead</p>
                                </div>
                                <button onClick={() => router.push('/sales/leads')} className="px-3 py-1 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600">
                                    Claim Lead
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <LeadList title="Assigned Today" leads={data.assignedToday || []} />
            <LeadList title="Active Follow-ups" leads={data.activeLeads || []} />
        </div>
    );

    return (
        <div className="space-y-8 pb-10">
            {/* ── Header ── */}
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{dateStr}</p>
                    <h1 className="text-3xl font-black text-gray-900 mt-1">{dayGreeting} 👋</h1>
                    <p className="text-gray-400 font-medium mt-1">[{data.role}] Here's what's on your plate today.</p>
                </div>
                <button
                    onClick={fetchData}
                    className="h-10 w-10 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-gray-400 hover:text-primary transition-colors"
                >
                    <RefreshCw className="h-4 w-4" />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content Area */}
                <div className="lg:col-span-2 space-y-6">
                    {data.role === 'Admin' && renderAdminDashboard()}
                    {data.role === 'Lead' && renderLeadDashboard()}
                    {data.role === 'Member' && renderMemberDashboard()}
                </div>

                {/* Notifications Sidebar */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-fit">
                    <div className="px-7 py-5 border-b border-gray-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Bell className="h-5 w-5 text-primary" />
                            <h2 className="text-sm font-black text-gray-900">Notifications</h2>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-[500px]">
                        {visibleNotifs.length === 0 ? (
                            <div className="py-16 flex flex-col items-center gap-3">
                                <p className="text-sm font-medium text-gray-400 text-center">All caught up! 🎉</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {visibleNotifs.map((notif: any) => (
                                    <div key={notif.id} className="px-6 py-4">
                                        <p className="text-sm font-semibold text-gray-800 leading-snug">{notif.message}</p>
                                        <p className="text-xs font-medium text-gray-400 mt-1">{notif.time}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Helper Components
function StatCard({ label, value, icon: Icon, color, bg }: any) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className={`h-11 w-11 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
                <p className="text-2xl font-black text-gray-900">{value}</p>
            </div>
        </div>
    );
}

function LeadList({ title, leads }: { title: string, leads: any[] }) {
    return (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-7 py-5 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FolderKanban className="h-5 w-5 text-primary" />
                    <div>
                        <h2 className="text-sm font-black text-gray-900">{title}</h2>
                        <p className="text-xs text-gray-400 font-medium">{leads.length} leads</p>
                    </div>
                </div>
            </div>

            {leads.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-3">
                    <FolderKanban className="h-10 w-10 text-gray-200" />
                    <p className="text-sm font-medium text-gray-400">No leads found</p>
                </div>
            ) : (
                <div className="divide-y divide-gray-50">
                    {leads.map((lead: any) => {
                        const s = STATUS_CONFIG[lead.status] || STATUS_CONFIG['New'];
                        return (
                            <div key={lead._id} className="px-7 py-4 flex items-center justify-between hover:bg-gray-50/50 cursor-pointer group">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-xs shrink-0">
                                        {lead.firstName?.[0]}{lead.lastName?.[0]}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900 group-hover:text-primary transition-colors">
                                            {lead.firstName} {lead.lastName}
                                        </p>
                                        <p className="text-xs text-gray-400 font-medium">{lead.company || lead.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`rounded-xl px-3 py-1 text-[10px] font-black uppercase tracking-widest border ${s.bg} ${s.text} ${s.border}`}>
                                        {lead.status}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    Mail,
    Phone,
    MessageSquare,
    RefreshCw,
    Search,
    Globe,
    ExternalLink,
    Building2,
    FileText,
} from 'lucide-react';
import { format } from 'date-fns';

const STATUS_CONFIG: Record<string, { bg: string; text: string }> = {
    'New': { bg: 'bg-blue-50', text: 'text-blue-700' },
    'Contacted': { bg: 'bg-purple-50', text: 'text-purple-700' },
    'In Progress': { bg: 'bg-amber-50', text: 'text-amber-700' },
    'Needs Analysis': { bg: 'bg-orange-50', text: 'text-orange-700' },
    'Proposal Sent': { bg: 'bg-indigo-50', text: 'text-indigo-700' },
    'Won': { bg: 'bg-emerald-50', text: 'text-emerald-700' },
    'Lost': { bg: 'bg-red-50', text: 'text-red-700' },
    'Closed': { bg: 'bg-gray-100', text: 'text-gray-600' },
    'Qualified': { bg: 'bg-teal-50', text: 'text-teal-700' },
};

const SERVICE_TABS = [
    { key: 'All', label: 'All Services' },
    { key: 'Technical Solutions', label: 'Technical Solutions' },
    { key: 'Enterprise Operation', label: 'Enterprise Operation' },
    { key: 'Talent Hire', label: 'Talent Hire' },
    { key: 'Consultation', label: 'Consultation' },
    { key: 'Bespoke Solution', label: 'Bespoke Solution' },
];

interface Lead {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    company?: string;
    status: string;
    createdAt: string;
    source?: { name: string };
    assignedTo?: { name: string; email: string };
    details?: Record<string, unknown>;
    remarks?: { note: string; createdAt: string }[];
}

export default function WebsiteLeadsPage() {
    const router = useRouter();
    const [leads, setLeads] = useState<Lead[]>([]);
    const [filtered, setFiltered] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [activeService, setActiveService] = useState('All');

    const fetchLeads = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/website-leads');
            const data = await res.json();
            setLeads(data.leads || []);
        } catch (err) {
            console.error('Failed to fetch website leads:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchLeads(); }, [fetchLeads]);

    useEffect(() => {
        let result = leads;

        if (activeService !== 'All') {
            result = result.filter(
                (l) => (l.details?.serviceLabel as string) === activeService
            );
        }

        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(
                (l) =>
                    `${l.firstName} ${l.lastName}`.toLowerCase().includes(q) ||
                    l.email.toLowerCase().includes(q) ||
                    (l.phone && l.phone.includes(q)) ||
                    (l.company && l.company.toLowerCase().includes(q))
            );
        }

        if (statusFilter !== 'All') {
            result = result.filter((l) => l.status === statusFilter);
        }

        setFiltered(result);
    }, [search, statusFilter, activeService, leads]);

    // Count per service for badge
    const countFor = (serviceLabel: string) =>
        serviceLabel === 'All'
            ? leads.length
            : leads.filter((l) => (l.details?.serviceLabel as string) === serviceLabel).length;

    const getProjectRequirements = (lead: Lead) => {
        const req = lead.details?.projectRequirements as string | undefined;
        if (req) return req;
        return lead.remarks?.[0]?.note || '';
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <p className="text-sm font-semibold text-gray-400">Loading website leads...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-10">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Globe className="h-5 w-5 text-primary" />
                        <h1 className="text-2xl font-black text-gray-900">Website Leads</h1>
                    </div>
                    <p className="text-sm text-gray-400 font-medium">
                        Leads from all service forms on{' '}
                        <a
                            href="https://www.talentronaut.in"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                            talentronaut.in
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-gray-400 bg-gray-100 px-3 py-1.5 rounded-xl">
                        {filtered.length} lead{filtered.length !== 1 ? 's' : ''}
                    </span>
                    <button
                        onClick={fetchLeads}
                        className="h-9 w-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Service Tabs */}
            <div className="flex flex-wrap gap-2">
                {SERVICE_TABS.map((tab) => {
                    const count = countFor(tab.key);
                    const isActive = activeService === tab.key;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveService(tab.key)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                                isActive
                                    ? 'bg-primary text-white shadow-sm'
                                    : 'bg-white border border-gray-200 text-gray-600 hover:border-primary/40 hover:text-primary'
                            }`}
                        >
                            {tab.label}
                            <span
                                className={`text-xs font-black px-1.5 py-0.5 rounded-md ${
                                    isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                                }`}
                            >
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Search + Status Filter */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name, email, phone or company…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                >
                    <option value="All">All Statuses</option>
                    {Object.keys(STATUS_CONFIG).map((s) => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            {filtered.length === 0 ? (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20 gap-4">
                    <Globe className="h-12 w-12 text-gray-200" />
                    <p className="text-base font-bold text-gray-400">No leads found</p>
                    <p className="text-sm text-gray-400 text-center max-w-xs">
                        Leads submitted via talentronaut.in service forms will appear here once the developer integrates the webhook.
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50/70 border-b border-gray-100">
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Prospect</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Contact</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Service</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Company</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Submitted</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">Assigned To</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filtered.map((lead) => {
                                    const statusCfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG['New'];
                                    const serviceLabel = lead.details?.serviceLabel as string | undefined;
                                    const requirements = getProjectRequirements(lead);

                                    return (
                                        <tr
                                            key={lead._id}
                                            onClick={() =>
                                                router.push(
                                                    `/admin/leads/${lead._id}?domain=Talentronaut+Website&campaign=Service+Leads`
                                                )
                                            }
                                            className="hover:bg-gray-50/60 cursor-pointer transition-colors"
                                        >
                                            {/* Prospect */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-xs shrink-0">
                                                        {lead.firstName?.[0]?.toUpperCase()}{lead.lastName?.[0]?.toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-gray-900 truncate">
                                                            {lead.firstName} {lead.lastName}
                                                        </p>
                                                        {requirements && (
                                                            <p className="text-xs text-gray-400 font-medium truncate max-w-[180px]" title={requirements}>
                                                                {requirements.length > 50 ? requirements.slice(0, 50) + '…' : requirements}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Contact */}
                                            <td className="px-6 py-4">
                                                <div className="space-y-1">
                                                    <a
                                                        href={`mailto:${lead.email}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-primary transition-colors"
                                                    >
                                                        <Mail className="h-3 w-3 shrink-0" />
                                                        <span className="truncate max-w-[150px]">{lead.email}</span>
                                                    </a>
                                                    {lead.phone && (
                                                        <a
                                                            href={`tel:${lead.phone}`}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-primary transition-colors"
                                                        >
                                                            <Phone className="h-3 w-3 shrink-0" />
                                                            <span>{lead.phone}</span>
                                                        </a>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Service */}
                                            <td className="px-6 py-4">
                                                {serviceLabel ? (
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/8 px-2.5 py-1 rounded-lg">
                                                        <FileText className="h-3 w-3" />
                                                        {serviceLabel}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-300">—</span>
                                                )}
                                            </td>

                                            {/* Company */}
                                            <td className="px-6 py-4">
                                                {lead.company || (lead.details?.company as string) ? (
                                                    <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                                                        <Building2 className="h-3 w-3" />
                                                        {lead.company || (lead.details?.company as string)}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-300">—</span>
                                                )}
                                            </td>

                                            {/* Status */}
                                            <td className="px-6 py-4">
                                                <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black ${statusCfg.bg} ${statusCfg.text}`}>
                                                    {lead.status}
                                                </span>
                                            </td>

                                            {/* Submitted */}
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-medium text-gray-500">
                                                    {format(new Date(lead.createdAt), 'dd MMM yyyy')}
                                                </span>
                                                <p className="text-[10px] text-gray-400">
                                                    {format(new Date(lead.createdAt), 'hh:mm a')}
                                                </p>
                                            </td>

                                            {/* Assigned To */}
                                            <td className="px-6 py-4">
                                                {lead.assignedTo ? (
                                                    <span className="text-xs font-semibold text-gray-700">
                                                        {lead.assignedTo.name}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-300 italic">Unassigned</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

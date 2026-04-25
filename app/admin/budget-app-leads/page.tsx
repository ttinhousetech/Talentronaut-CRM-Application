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
    FileText,
    Calculator,
    ExternalLink,
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

interface Lead {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    status: string;
    createdAt: string;
    source?: { name: string };
    assignedTo?: { name: string; email: string };
    details?: Record<string, unknown>;
    remarks?: { note: string; createdAt: string }[];
}

export default function BudgetAppLeadsPage() {
    const router = useRouter();
    const [leads, setLeads] = useState<Lead[]>([]);
    const [filtered, setFiltered] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    const fetchLeads = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/budget-app-leads');
            const data = await res.json();
            setLeads(data.leads || []);
            setFiltered(data.leads || []);
        } catch (err) {
            console.error('Failed to fetch budget app leads:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchLeads(); }, [fetchLeads]);

    useEffect(() => {
        let result = leads;
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(
                (l) =>
                    `${l.firstName} ${l.lastName}`.toLowerCase().includes(q) ||
                    l.email.toLowerCase().includes(q) ||
                    (l.phone && l.phone.includes(q))
            );
        }
        if (statusFilter !== 'All') {
            result = result.filter((l) => l.status === statusFilter);
        }
        setFiltered(result);
    }, [search, statusFilter, leads]);

    const getWhatsapp = (lead: Lead) =>
        lead.details?.whatsapp as string | undefined;

    const getProjectDomain = (lead: Lead) =>
        lead.details?.projectDomain as string | undefined;

    const getCountry = (lead: Lead) =>
        lead.details?.country as string | undefined;

    const getProjectDescription = (lead: Lead) => {
        const desc = lead.details?.projectDescription as string | undefined;
        if (desc) return desc;
        // Fallback: first remark note may have the form submission data
        return lead.remarks?.[0]?.note || '';
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <p className="text-sm font-semibold text-gray-400">Loading budget app leads...</p>
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
                        <Calculator className="h-5 w-5 text-primary" />
                        <h1 className="text-2xl font-black text-gray-900">Budget App Leads</h1>
                    </div>
                    <p className="text-sm text-gray-400 font-medium">
                        Leads captured from{' '}
                        <a
                            href="https://campaign.talentronaut.in"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                            campaign.talentronaut.in
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

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by name, email or phone…"
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
                    <Calculator className="h-12 w-12 text-gray-200" />
                    <p className="text-base font-bold text-gray-400">No budget app leads found</p>
                    <p className="text-sm text-gray-400">
                        Leads submitted via campaign.talentronaut.in will appear here
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50/70 border-b border-gray-100">
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">
                                        Prospect
                                    </th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">
                                        Contact
                                    </th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">
                                        Project Domain
                                    </th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">
                                        Country
                                    </th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">
                                        Status
                                    </th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">
                                        Submitted
                                    </th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">
                                        Assigned To
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filtered.map((lead) => {
                                    const statusCfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG['New'];
                                    const whatsapp = getWhatsapp(lead);
                                    const projectDomain = getProjectDomain(lead);
                                    const country = getCountry(lead);
                                    const description = getProjectDescription(lead);

                                    return (
                                        <tr
                                            key={lead._id}
                                            onClick={() => router.push(`/admin/leads/${lead._id}?domain=Budget+App&campaign=Budget+Campaign&source=campaign.talentronaut.in`)}
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
                                                        <p className="text-xs text-gray-400 font-medium truncate max-w-[180px]" title={description}>
                                                            {description
                                                                ? description.length > 50
                                                                    ? description.slice(0, 50) + '…'
                                                                    : description
                                                                : '—'}
                                                        </p>
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
                                                    {whatsapp && (
                                                        <a
                                                            href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 transition-colors"
                                                        >
                                                            <MessageSquare className="h-3 w-3 shrink-0" />
                                                            <span>{whatsapp}</span>
                                                        </a>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Project Domain */}
                                            <td className="px-6 py-4">
                                                {projectDomain ? (
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg">
                                                        <FileText className="h-3 w-3" />
                                                        {projectDomain}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-300">—</span>
                                                )}
                                            </td>

                                            {/* Country */}
                                            <td className="px-6 py-4">
                                                {country ? (
                                                    <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                                                        <Globe className="h-3 w-3" />
                                                        {country}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-300">—</span>
                                                )}
                                            </td>

                                            {/* Status */}
                                            <td className="px-6 py-4">
                                                <span
                                                    className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black ${statusCfg.bg} ${statusCfg.text}`}
                                                >
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

'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeft, Mail, Phone, Building2, Globe, Calendar, MessageSquare,
    Video, CheckCircle2, RefreshCw, XCircle, Loader2, Pencil, Trash2,
    Plus, User, Save, ExternalLink, ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';

const ALL_STATUSES = ['New', 'Contacted', 'In Progress', 'Needs Analysis', 'Proposal Sent', 'Won', 'Lost', 'Closed'];

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
    'New': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    'Contacted': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    'In Progress': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    'Needs Analysis': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    'Proposal Sent': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    'Won': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    'Lost': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    'Closed': { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
};

const MEETING_STATUS_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
    'Scheduled': { icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
    'Completed': { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    'Rescheduled': { icon: RefreshCw, color: 'text-amber-600', bg: 'bg-amber-50' },
    'Cancelled': { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
};

export default function AdminLeadDetailPage() {
    const { data: session } = useSession();
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const isAdmin = session?.user?.role === 'Admin';

    // Breadcrumb info passed from the config page via query params
    const domain = searchParams.get('domain') || '';
    const campaign = searchParams.get('campaign') || '';
    const source = searchParams.get('source') || '';

    const [lead, setLead] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [users, setUsers] = useState<any[]>([]);

    // Remarks form state
    const [remarkNote, setRemarkNote] = useState('');
    const [remarkMethod, setRemarkMethod] = useState('Call');
    const [remarkDate, setRemarkDate] = useState('');
    const [addingRemark, setAddingRemark] = useState(false);

    // Meeting form state
    const [showMeetingForm, setShowMeetingForm] = useState(false);
    const [meetingTitle, setMeetingTitle] = useState('');
    const [meetingDate, setMeetingDate] = useState('');
    const [meetingLink, setMeetingLink] = useState('');
    const [addingMeeting, setAddingMeeting] = useState(false);

    // Edit state (admin only)
    const [editMode, setEditMode] = useState(false);
    const [editData, setEditData] = useState<any>({});

    const fetchLead = async () => {
        try {
            const res = await fetch(`/api/leads/${params.id}`);
            const data = await res.json();
            if (!data.lead) { setLead(null); setLoading(false); return; }
            setLead(data.lead);
            setEditData({
                firstName: data.lead.firstName || '',
                lastName: data.lead.lastName || '',
                email: data.lead.email || '',
                phone: data.lead.phone || '',
                company: data.lead.company || '',
                sourceUrl: data.lead.sourceUrl || '',
                status: data.lead.status || 'New',
                value: data.lead.value || 0,
                assignedTo: data.lead.assignedTo?._id || '',
            });
        } catch (err) {
            setLead(null);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        if (!isAdmin) return;
        const res = await fetch('/api/admin/users?toolId=crm');
        const data = await res.json();
        setUsers(data.users || []);
    };

    useEffect(() => {
        if (params.id) { fetchLead(); fetchUsers(); }
    }, [params.id]);

    const handleStatusChange = async (status: string) => {
        setSaving(true);
        await fetch(`/api/leads/${params.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
        await fetchLead();
        setSaving(false);
    };

    const handleSaveEdit = async () => {
        setSaving(true);
        await fetch(`/api/leads/${params.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editData),
        });
        await fetchLead();
        setEditMode(false);
        setSaving(false);
    };

    const handleAddRemark = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!remarkNote.trim()) return;
        setAddingRemark(true);
        await fetch(`/api/leads/${params.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                addRemark: { note: remarkNote, method: remarkMethod, lastContactedDate: remarkDate || undefined }
            }),
        });
        setRemarkNote(''); setRemarkDate(''); setRemarkMethod('Call');
        await fetchLead();
        setAddingRemark(false);
    };

    const handleAddMeeting = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!meetingTitle || !meetingDate) return;
        setAddingMeeting(true);
        await fetch(`/api/leads/${params.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addMeeting: { title: meetingTitle, date: meetingDate, link: meetingLink } }),
        });
        setMeetingTitle(''); setMeetingDate(''); setMeetingLink('');
        setShowMeetingForm(false);
        await fetchLead();
        setAddingMeeting(false);
    };

    const handleUpdateMeetingStatus = async (meetingId: string, status: string) => {
        await fetch(`/api/leads/${params.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updateMeeting: { meetingId, status } }),
        });
        await fetchLead();
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to permanently delete this lead?')) return;
        await fetch(`/api/leads/${params.id}`, { method: 'DELETE' });
        router.back();
    };

    if (loading) return (
        <div className="flex h-96 items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary/30" />
        </div>
    );

    if (!lead) return (
        <div className="flex flex-col items-center justify-center gap-4 py-32">
            <div className="h-20 w-20 rounded-full bg-red-50 flex items-center justify-center">
                <XCircle className="h-10 w-10 text-red-300" />
            </div>
            <p className="text-xl font-black text-gray-900">Lead not found</p>
            <button onClick={() => router.back()} className="mt-2 flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-black text-sm shadow-lg shadow-primary/20">
                <ArrowLeft className="h-4 w-4" /> Go Back
            </button>
        </div>
    );

    const sc = STATUS_CONFIG[lead.status] || STATUS_CONFIG['New'];
    const leadName = `${lead.firstName} ${lead.lastName}`.trim();

    // Build breadcrumb back URL
    const backUrl = '/admin/configuration';

    return (
        <div className="space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-gray-400 overflow-x-auto pb-1 whitespace-nowrap scrollbar-hide">
                <button onClick={() => router.push(backUrl)} className="hover:text-primary transition-colors">
                    Domains
                </button>
                {domain && <>
                    <ChevronRight className="h-4 w-4 shrink-0" />
                    <button onClick={() => router.push(backUrl)} className="hover:text-primary transition-colors">{domain}</button>
                </>}
                {campaign && <>
                    <ChevronRight className="h-4 w-4 shrink-0" />
                    <button onClick={() => router.push(backUrl)} className="hover:text-primary transition-colors">{campaign}</button>
                </>}
                {source && <>
                    <ChevronRight className="h-4 w-4 shrink-0" />
                    <button onClick={() => router.push(backUrl)} className="hover:text-primary transition-colors">{source}</button>
                </>}
                <ChevronRight className="h-4 w-4 shrink-0" />
                <span className="font-semibold text-gray-900 underline underline-offset-4 decoration-primary">{leadName}</span>
            </div>

            {/* Lead Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="font-brand text-3xl font-bold text-gray-900">{leadName}</h1>
                        <p className="text-sm font-medium text-gray-400">{lead.email}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wider border ${sc.bg} ${sc.text} ${sc.border}`}>
                        {lead.status}
                    </span>
                    {isAdmin && (
                        <>
                            <button
                                onClick={() => setEditMode(!editMode)}
                                className="h-10 w-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"
                            >
                                <Pencil className="h-4 w-4" />
                            </button>
                            <button
                                onClick={handleDelete}
                                className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center text-red-400 hover:text-red-600 transition-colors"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* LEFT COLUMN */}
                <div className="lg:col-span-1 space-y-6">

                    {/* Lead Info Card */}
                    <div className="rounded-[2rem] bg-white border border-gray-100 shadow-lg shadow-gray-200/40 p-8">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-black text-gray-900">Lead Info</h2>
                            {isAdmin && !editMode && (
                                <button onClick={() => setEditMode(true)} className="text-xs font-bold text-primary hover:underline">Edit</button>
                            )}
                        </div>

                        {editMode && isAdmin ? (
                            <div className="space-y-4">
                                {[
                                    { label: 'First Name', key: 'firstName' },
                                    { label: 'Last Name', key: 'lastName' },
                                    { label: 'Email', key: 'email' },
                                    { label: 'Phone', key: 'phone' },
                                    { label: 'Company', key: 'company' },
                                    { label: 'Source URL', key: 'sourceUrl' },
                                    { label: 'Deal Value (₹)', key: 'value', type: 'number' },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">{f.label}</label>
                                        <input
                                            type={f.type || 'text'}
                                            value={editData[f.key]}
                                            onChange={e => setEditData({ ...editData, [f.key]: e.target.value })}
                                            className="mt-1 w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5 text-sm font-bold text-gray-900 focus:border-primary focus:bg-white focus:outline-none transition-all"
                                        />
                                    </div>
                                ))}
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Assigned To</label>
                                    <select
                                        value={editData.assignedTo}
                                        onChange={e => setEditData({ ...editData, assignedTo: e.target.value })}
                                        className="mt-1 w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5 text-sm font-bold text-gray-900 focus:border-primary focus:bg-white focus:outline-none transition-all"
                                    >
                                        <option value="">Unassigned</option>
                                        {users.map(u => (
                                            <option key={u._id} value={u._id}>
                                                {u.name} ({u.email})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setEditMode(false)} className="flex-1 py-2.5 text-sm font-bold text-gray-400 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">Cancel</button>
                                    <button onClick={handleSaveEdit} disabled={saving} className="flex-1 py-2.5 text-sm font-black text-white bg-primary rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform active:scale-95 disabled:opacity-50">
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Save'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {[
                                    { icon: Mail, label: 'Email', value: lead.email },
                                    { icon: Phone, label: 'Phone', value: lead.phone || '—' },
                                    { icon: Building2, label: 'Company', value: lead.company || '—' },
                                    { icon: Globe, label: 'Source URL', value: lead.sourceUrl || '—', isLink: !!lead.sourceUrl },
                                    { icon: User, label: 'Assigned To', value: lead.assignedTo?.name || 'Unassigned' },
                                ].map(f => (
                                    <div key={f.label} className="flex items-start gap-3">
                                        <div className="h-9 w-9 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                                            <f.icon className="h-4 w-4 text-gray-400" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{f.label}</p>
                                            {f.isLink ? (
                                                <a href={f.value} target="_blank" rel="noreferrer" className="text-sm font-bold text-primary hover:underline flex items-center gap-1 truncate">
                                                    {f.value} <ExternalLink className="h-3 w-3 shrink-0" />
                                                </a>
                                            ) : (
                                                <p className="text-sm font-bold text-gray-900 truncate">{f.value}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <div className="pt-2 border-t border-gray-50">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Source</p>
                                    <span className="inline-block rounded-xl bg-primary/5 text-primary text-xs font-bold px-3 py-1.5">{lead.source?.name || 'Unknown'}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Status Workflow */}
                    <div className="rounded-[2rem] bg-white border border-gray-100 shadow-lg shadow-gray-200/40 p-8">
                        <h2 className="text-lg font-black text-gray-900 mb-6">Status Workflow</h2>
                        <div className="space-y-2">
                            {ALL_STATUSES.map(status => {
                                const cfg = STATUS_CONFIG[status];
                                const isActive = lead.status === status;
                                return (
                                    <button
                                        key={status}
                                        onClick={() => handleStatusChange(status)}
                                        disabled={saving}
                                        className={`w-full flex items-center justify-between px-5 py-3 rounded-xl font-bold text-sm transition-all ${isActive
                                            ? `${cfg.bg} ${cfg.text} border-2 ${cfg.border} shadow-sm`
                                            : 'hover:bg-gray-50 text-gray-500 border-2 border-transparent'
                                            } disabled:opacity-50`}
                                    >
                                        <span>{status}</span>
                                        {isActive && <div className="h-2 w-2 rounded-full bg-current" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Meetings */}
                    <div className="rounded-[2rem] bg-white border border-gray-100 shadow-lg shadow-gray-200/40 p-8">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-black text-gray-900">Meetings</h2>
                            <button
                                onClick={() => setShowMeetingForm(!showMeetingForm)}
                                className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-colors"
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                        </div>

                        {showMeetingForm && (
                            <form onSubmit={handleAddMeeting} className="mb-6 space-y-3 p-5 bg-gray-50 rounded-2xl">
                                <input type="text" placeholder="Meeting title" value={meetingTitle} onChange={e => setMeetingTitle(e.target.value)}
                                    className="w-full rounded-xl border border-gray-100 bg-white px-4 py-2.5 text-sm font-bold focus:border-primary focus:outline-none" required />
                                <input type="datetime-local" value={meetingDate} onChange={e => setMeetingDate(e.target.value)}
                                    className="w-full rounded-xl border border-gray-100 bg-white px-4 py-2.5 text-sm font-bold focus:border-primary focus:outline-none" required />
                                <input type="url" placeholder="Meeting link (optional)" value={meetingLink} onChange={e => setMeetingLink(e.target.value)}
                                    className="w-full rounded-xl border border-gray-100 bg-white px-4 py-2.5 text-sm font-bold focus:border-primary focus:outline-none" />
                                <button type="submit" disabled={addingMeeting} className="w-full py-2.5 bg-primary text-white text-sm font-black rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform active:scale-95 disabled:opacity-50">
                                    {addingMeeting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Schedule Meeting'}
                                </button>
                            </form>
                        )}

                        <div className="space-y-4">
                            {lead.meetings?.length === 0 && (
                                <p className="text-center text-sm text-gray-300 font-medium italic py-6">No meetings scheduled.</p>
                            )}
                            {lead.meetings?.map((m: any) => {
                                const mc = MEETING_STATUS_CONFIG[m.status] || MEETING_STATUS_CONFIG['Scheduled'];
                                const Icon = mc.icon;
                                return (
                                    <div key={m._id} className="rounded-2xl border border-gray-50 bg-gray-50/50 p-5">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="font-bold text-gray-900 truncate">{m.title}</p>
                                                <p className="text-xs font-medium text-gray-400 mt-1">{format(new Date(m.date), 'dd MMM yyyy, hh:mm a')}</p>
                                                {m.link && (
                                                    <a href={m.link} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary hover:underline flex items-center gap-1 mt-1">
                                                        <Video className="h-3 w-3" /> Join Link
                                                    </a>
                                                )}
                                            </div>
                                            <div className={`shrink-0 h-8 w-8 rounded-xl flex items-center justify-center ${mc.bg}`}>
                                                <Icon className={`h-4 w-4 ${mc.color}`} />
                                            </div>
                                        </div>
                                        <div className="mt-3 flex gap-2 flex-wrap">
                                            {['Completed', 'Rescheduled', 'Cancelled'].map(s => (
                                                <button key={s} onClick={() => handleUpdateMeetingStatus(m._id, s)} disabled={m.status === s}
                                                    className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg transition-colors disabled:opacity-30 ${s === 'Completed' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' :
                                                        s === 'Rescheduled' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' :
                                                            'bg-red-100 text-red-700 hover:bg-red-200'}`}>
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Add Remark */}
                    <div className="rounded-[2rem] bg-white border border-gray-100 shadow-lg shadow-gray-200/40 p-8">
                        <h2 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-3">
                            <MessageSquare className="h-5 w-5 text-primary" />
                            Add Communication Log
                        </h2>
                        <form onSubmit={handleAddRemark} className="space-y-4">
                            <textarea
                                rows={4}
                                placeholder="Write your note, outcome of the call, key points discussed..."
                                value={remarkNote}
                                onChange={e => setRemarkNote(e.target.value)}
                                className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 px-5 py-4 text-sm font-medium text-gray-900 placeholder:text-gray-300 focus:border-primary focus:bg-white focus:outline-none transition-all resize-none"
                                required
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Method</label>
                                    <select value={remarkMethod} onChange={e => setRemarkMethod(e.target.value)}
                                        className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5 text-sm font-bold text-gray-900 focus:border-primary focus:outline-none">
                                        {['Call', 'Email', 'WhatsApp', 'In-Person', 'Other'].map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Last Contacted Date</label>
                                    <input type="date" value={remarkDate} onChange={e => setRemarkDate(e.target.value)}
                                        className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5 text-sm font-bold text-gray-900 focus:border-primary focus:outline-none" />
                                </div>
                            </div>
                            <button type="submit" disabled={addingRemark || !remarkNote.trim()} className="flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-2xl font-black text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform active:scale-95 disabled:opacity-50">
                                {addingRemark ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Save Note
                            </button>
                        </form>
                    </div>

                    {/* Communication Timeline */}
                    <div className="rounded-[2rem] bg-white border border-gray-100 shadow-lg shadow-gray-200/40 p-8">
                        <h2 className="text-lg font-black text-gray-900 mb-8">Communication Timeline</h2>
                        {lead.remarks?.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="h-16 w-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                                    <MessageSquare className="h-8 w-8 text-gray-200" />
                                </div>
                                <p className="text-gray-400 font-medium italic">No communication logged yet.</p>
                                <p className="text-sm text-gray-300 mt-1">Add your first note above.</p>
                            </div>
                        ) : (
                            <div className="relative space-y-0">
                                <div className="absolute left-5 top-4 bottom-4 w-0.5 bg-gray-100" />
                                {[...lead.remarks].reverse().map((remark: any, i: number) => {
                                    const methodColors: Record<string, string> = {
                                        'Call': 'bg-blue-100 text-blue-700',
                                        'Email': 'bg-purple-100 text-purple-700',
                                        'WhatsApp': 'bg-emerald-100 text-emerald-700',
                                        'In-Person': 'bg-orange-100 text-orange-700',
                                        'Other': 'bg-gray-100 text-gray-600',
                                    };
                                    return (
                                        <div key={i} className="relative flex gap-6 pb-8 last:pb-0">
                                            <div className="shrink-0 h-10 w-10 rounded-full bg-white border-2 border-gray-100 flex items-center justify-center z-10 shadow-sm">
                                                <MessageSquare className="h-4 w-4 text-gray-400" />
                                            </div>
                                            <div className="flex-1 rounded-2xl border border-gray-50 bg-gray-50/60 p-6">
                                                <div className="flex items-start justify-between gap-4 mb-3">
                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${methodColors[remark.method] || methodColors['Other']}`}>
                                                            {remark.method}
                                                        </span>
                                                        {remark.lastContactedDate && (
                                                            <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                                                                <Calendar className="h-3 w-3" />
                                                                {format(new Date(remark.lastContactedDate), 'dd MMM yyyy')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs font-medium text-gray-400 whitespace-nowrap shrink-0">
                                                        {remark.createdAt ? format(new Date(remark.createdAt), 'dd MMM yy, hh:mm a') : ''}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-medium text-gray-700 leading-relaxed">{remark.note}</p>
                                                {remark.addedByName && (
                                                    <p className="text-xs font-bold text-gray-400 mt-3">— {remark.addedByName}</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

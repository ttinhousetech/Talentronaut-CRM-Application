'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
    ArrowLeft, Mail, Phone, Building2, Globe, Calendar, MessageSquare,
    Video, CheckCircle2, RefreshCw, XCircle, Loader2, Pencil, Trash2,
    Plus, User, Save, ExternalLink, X
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

interface Props {
    leadId: string;
    onClose: () => void;
    onDeleted?: () => void;
}

export default function LeadDetailPanel({ leadId, onClose, onDeleted }: Props) {
    const { data: session } = useSession();
    const isAdmin = session?.user?.role === 'Admin';

    const [lead, setLead] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [users, setUsers] = useState<any[]>([]);

    const [remarkNote, setRemarkNote] = useState('');
    const [remarkMethod, setRemarkMethod] = useState('Call');
    const [remarkDate, setRemarkDate] = useState('');
    const [addingRemark, setAddingRemark] = useState(false);

    const [showMeetingForm, setShowMeetingForm] = useState(false);
    const [meetingTitle, setMeetingTitle] = useState('');
    const [meetingDate, setMeetingDate] = useState('');
    const [meetingLink, setMeetingLink] = useState('');
    const [meetingHostId, setMeetingHostId] = useState('');
    const [hostAvailability, setHostAvailability] = useState<any[]>([]);
    const [fetchingAvailability, setFetchingAvailability] = useState(false);
    const [addingMeeting, setAddingMeeting] = useState(false);

    const [editMode, setEditMode] = useState(false);
    const [editData, setEditData] = useState<any>({});

    const fetchLead = useCallback(async () => {
        try {
            const res = await fetch(`/api/leads/${leadId}`);
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
            console.error('Failed to fetch lead', err);
            setLead(null);
        } finally {
            setLoading(false);
        }
    }, [leadId]);

    useEffect(() => {
        setLoading(true);
        setLead(null);
        setEditMode(false);
        fetchLead();
        fetch('/api/admin/users?toolId=crm').then(r => r.json()).then(d => setUsers(d.users || []));
    }, [leadId, fetchLead, isAdmin]);

    useEffect(() => {
        if (!meetingHostId) {
            setHostAvailability([]);
            return;
        }
        const fetchAvailability = async () => {
            setFetchingAvailability(true);
            try {
                const res = await fetch(`/api/availability?leaderId=${meetingHostId}`);
                const data = await res.json();
                setHostAvailability(data.availability || []);
            } catch (err) {
                console.error(err);
            } finally {
                setFetchingAvailability(false);
            }
        };
        fetchAvailability();
    }, [meetingHostId]);

    const handleStatusChange = async (status: string) => {
        setSaving(true);
        await fetch(`/api/leads/${leadId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
        await fetchLead();
        setSaving(false);
    };

    const handleSaveEdit = async () => {
        setSaving(true);
        await fetch(`/api/leads/${leadId}`, {
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
        await fetch(`/api/leads/${leadId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addRemark: { note: remarkNote, method: remarkMethod, lastContactedDate: remarkDate || undefined } }),
        });
        setRemarkNote(''); setRemarkDate(''); setRemarkMethod('Call');
        await fetchLead();
        setAddingRemark(false);
    };

    const handleAddMeeting = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!meetingTitle || !meetingDate) return;
        setAddingMeeting(true);
        await fetch(`/api/leads/${leadId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addMeeting: { title: meetingTitle, date: meetingDate, link: meetingLink, hostId: meetingHostId } }),
        });
        setMeetingTitle(''); setMeetingDate(''); setMeetingLink(''); setMeetingHostId('');
        setShowMeetingForm(false);
        await fetchLead();
        setAddingMeeting(false);
    };

    const handleUpdateMeetingStatus = async (meetingId: string, status: string) => {
        await fetch(`/api/leads/${leadId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updateMeeting: { meetingId, status } }),
        });
        await fetchLead();
    };

    const handleDelete = async () => {
        if (!confirm('Permanently delete this lead?')) return;
        await fetch(`/api/leads/${leadId}`, { method: 'DELETE' });
        onDeleted?.();
        onClose();
    };

    if (loading) return (
        <div className="flex h-full items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
        </div>
    );

    if (!lead) return (
        <div className="flex h-full flex-col items-center justify-center gap-4 text-center p-8">
            <XCircle className="h-12 w-12 text-red-200" />
            <p className="font-bold text-gray-500">Lead not found</p>
            <button onClick={onClose} className="text-sm font-bold text-primary hover:underline">Go back</button>
        </div>
    );

    const sc = STATUS_CONFIG[lead.status] || STATUS_CONFIG['New'];

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Panel Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    <button onClick={onClose} className="h-8 w-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-primary/10 hover:text-primary transition-colors shrink-0">
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div className="min-w-0">
                        <h2 className="font-black text-gray-900 text-base truncate">{lead.firstName} {lead.lastName}</h2>
                        <p className="text-xs text-gray-400 font-medium truncate">{lead.email}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border ${sc.bg} ${sc.text} ${sc.border}`}>
                        {lead.status}
                    </span>
                    {isAdmin && (
                        <>
                            <button onClick={() => setEditMode(!editMode)} className="h-8 w-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-primary transition-colors">
                                <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={handleDelete} className="h-8 w-8 rounded-xl bg-red-50 flex items-center justify-center text-red-400 hover:text-red-600 transition-colors">
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </>
                    )}
                    <button onClick={onClose} className="h-8 w-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-gray-50/50">

                {/* Lead Info */}
                <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-black text-gray-900">Lead Info</h3>
                        {isAdmin && !editMode && <button onClick={() => setEditMode(true)} className="text-[11px] font-bold text-primary hover:underline">Edit</button>}
                    </div>
                    {editMode && isAdmin ? (
                        <div className="space-y-3">
                            {[
                                { label: 'First Name', key: 'firstName' }, { label: 'Last Name', key: 'lastName' },
                                { label: 'Email', key: 'email' }, { label: 'Phone', key: 'phone' },
                                { label: 'Company', key: 'company' }, { label: 'Source URL', key: 'sourceUrl' },
                                { label: 'Deal Value (₹)', key: 'value', type: 'number' },
                            ].map(f => (
                                <div key={f.key}>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{f.label}</label>
                                    <input type={f.type || 'text'} value={editData[f.key]}
                                        onChange={e => setEditData({ ...editData, [f.key]: e.target.value })}
                                        className="mt-1 w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-900 focus:border-primary focus:bg-white focus:outline-none transition-all"
                                    />
                                </div>
                            ))}
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Assigned To</label>
                                <select value={editData.assignedTo} onChange={e => setEditData({ ...editData, assignedTo: e.target.value })}
                                    className="mt-1 w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-900 focus:border-primary focus:bg-white focus:outline-none">
                                    <option value="">Unassigned</option>
                                        {users.map(u => (
                                            <option key={u._id} value={u._id}>
                                                {u.name} ({u.email})
                                            </option>
                                        ))}
                                </select>
                            </div>
                            <div className="flex gap-2 pt-1">
                                <button onClick={() => setEditMode(false)} className="flex-1 py-2 text-sm font-bold text-gray-400 bg-gray-50 rounded-xl hover:bg-gray-100">Cancel</button>
                                <button onClick={handleSaveEdit} disabled={saving} className="flex-1 py-2 text-sm font-black text-white bg-primary rounded-xl disabled:opacity-50">
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Save'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {[
                                { icon: Mail, label: 'Email', value: lead.email },
                                { icon: Phone, label: 'Phone', value: lead.phone || '—' },
                                { icon: Building2, label: 'Company', value: lead.company || '—' },
                                { icon: Globe, label: 'Source URL', value: lead.sourceUrl || '—', isLink: !!lead.sourceUrl },
                                { icon: User, label: 'Assigned To', value: lead.assignedTo?.name || 'Unassigned' },
                            ].map(f => (
                                <div key={f.label} className="flex items-start gap-3">
                                    <div className="h-7 w-7 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                                        <f.icon className="h-3.5 w-3.5 text-gray-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{f.label}</p>
                                        {f.isLink ? (
                                            <a href={f.value} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary hover:underline flex items-center gap-1 truncate">
                                                {f.value} <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                                            </a>
                                        ) : (
                                            <p className="text-sm font-bold text-gray-900 truncate">{f.value}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div className="pt-2 border-t border-gray-50">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Source</p>
                                <span className="inline-block rounded-lg bg-primary/5 text-primary text-xs font-bold px-2.5 py-1">{lead.source?.name || 'Unknown'}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Status Workflow */}
                <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
                    <h3 className="text-sm font-black text-gray-900 mb-3">Status</h3>
                    <div className="grid grid-cols-2 gap-1.5">
                        {ALL_STATUSES.map(status => {
                            const cfg = STATUS_CONFIG[status];
                            const isActive = lead.status === status;
                            return (
                                <button key={status} onClick={() => handleStatusChange(status)} disabled={saving}
                                    className={`flex items-center justify-between px-3 py-2 rounded-xl font-bold text-xs transition-all disabled:opacity-50 ${isActive
                                        ? `${cfg.bg} ${cfg.text} border-2 ${cfg.border}`
                                        : 'hover:bg-gray-50 text-gray-500 border-2 border-transparent'
                                        }`}>
                                    <span>{status}</span>
                                    {isActive && <div className="h-1.5 w-1.5 rounded-full bg-current" />}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Add Communication Log */}
                <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
                    <h3 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-primary" /> Add Note
                    </h3>
                    <form onSubmit={handleAddRemark} className="space-y-3">
                        <textarea rows={3} placeholder="Outcome, key points, next steps..."
                            value={remarkNote} onChange={e => setRemarkNote(e.target.value)} required
                            className="w-full rounded-xl border-2 border-gray-100 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 placeholder:text-gray-300 focus:border-primary focus:bg-white focus:outline-none transition-all resize-none"
                        />
                        <div className="grid grid-cols-2 gap-2">
                            <select value={remarkMethod} onChange={e => setRemarkMethod(e.target.value)}
                                className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-900 focus:border-primary focus:outline-none">
                                {['Call', 'Email', 'WhatsApp', 'In-Person', 'Other'].map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <input type="date" value={remarkDate} onChange={e => setRemarkDate(e.target.value)}
                                className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-900 focus:border-primary focus:outline-none"
                            />
                        </div>
                        <button type="submit" disabled={addingRemark || !remarkNote.trim()}
                            className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-black text-xs shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform active:scale-95 disabled:opacity-50">
                            {addingRemark ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                            Save Note
                        </button>
                    </form>
                </div>

                {/* Communication Timeline */}
                {(lead.remarks?.length ?? 0) > 0 && (
                    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
                        <h3 className="text-sm font-black text-gray-900 mb-4">Communication Timeline</h3>
                        <div className="relative space-y-0">
                            <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gray-100" />
                            {[...lead.remarks].reverse().map((remark: any, i: number) => {
                                const methodColors: Record<string, string> = {
                                    'Call': 'bg-blue-100 text-blue-700',
                                    'Email': 'bg-purple-100 text-purple-700',
                                    'WhatsApp': 'bg-emerald-100 text-emerald-700',
                                    'In-Person': 'bg-orange-100 text-orange-700',
                                    'Other': 'bg-gray-100 text-gray-600',
                                };
                                return (
                                    <div key={i} className="relative flex gap-4 pb-5 last:pb-0">
                                        <div className="shrink-0 h-8 w-8 rounded-full bg-white border-2 border-gray-100 flex items-center justify-center z-10 shadow-sm">
                                            <MessageSquare className="h-3 w-3 text-gray-400" />
                                        </div>
                                        <div className="flex-1 rounded-xl border border-gray-50 bg-gray-50/60 p-4">
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-lg ${methodColors[remark.method] || methodColors['Other']}`}>
                                                        {remark.method}
                                                    </span>
                                                    {remark.lastContactedDate && (
                                                        <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                                                            <Calendar className="h-2.5 w-2.5" />
                                                            {format(new Date(remark.lastContactedDate), 'dd MMM yyyy')}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[10px] font-medium text-gray-400 whitespace-nowrap shrink-0">
                                                    {remark.createdAt ? format(new Date(remark.createdAt), 'dd MMM, h:mm a') : ''}
                                                </span>
                                            </div>
                                            <p className="text-xs font-medium text-gray-700 leading-relaxed">{remark.note}</p>
                                            {remark.addedByName && <p className="text-[10px] font-bold text-gray-400 mt-2">— {remark.addedByName}</p>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Meetings */}
                <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-black text-gray-900">Meetings</h3>
                        <button onClick={() => setShowMeetingForm(!showMeetingForm)}
                            className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-colors">
                            <Plus className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    {showMeetingForm && (
                        <form onSubmit={handleAddMeeting} className="mb-4 space-y-2 p-4 bg-gray-50 rounded-xl border border-gray-100 shadow-sm">
                            <input type="text" placeholder="Meeting title" value={meetingTitle} onChange={e => setMeetingTitle(e.target.value)} required
                                className="w-full rounded-xl border border-gray-100 bg-white px-3 py-2 text-sm font-bold focus:border-primary focus:outline-none" />
                            <select value={meetingHostId} onChange={e => setMeetingHostId(e.target.value)} required
                                className="w-full rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs font-bold focus:border-primary focus:outline-none text-gray-500">
                                <option value="" disabled>Select Leader / Host</option>
                                {users.filter(u => u.role === 'Lead' || u.role === 'Admin').map(u => (
                                    <option key={u._id} value={u._id} className="text-gray-900">{u.name} ({u.role})</option>
                                ))}
                            </select>

                            {/* Show availability if host is selected */}
                            {meetingHostId && (
                                <div className="rounded-xl border border-gray-100 bg-white p-3 text-xs">
                                    <p className="font-bold text-gray-900 mb-2">Available Slots:</p>
                                    {fetchingAvailability ? (
                                        <p className="text-gray-400 font-medium flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Fetching schedule...</p>
                                    ) : hostAvailability.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {/* Map numbers 0-6 to generic day names */}
                                            {hostAvailability.filter(a => a.isAvailable).map((a) => {
                                                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                                const dayName = days[a.dayOfWeek];
                                                return (
                                                    <span key={a.dayOfWeek} className="bg-primary/5 text-primary border border-primary/20 px-2 py-1 rounded-lg font-bold">
                                                        {dayName}: {a.startTime} - {a.endTime}
                                                    </span>
                                                );
                                            })}
                                            {hostAvailability.filter(a => a.isAvailable).length === 0 && (
                                                <p className="text-gray-400 font-medium italic">This Leader has not set their availability yet.</p>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-gray-400 font-medium italic">This Leader has not set their availability yet.</p>
                                    )}
                                </div>
                            )}

                            <input type="datetime-local" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} required
                                className="w-full rounded-xl border border-gray-100 bg-white px-3 py-2 text-sm font-bold focus:border-primary focus:outline-none" />
                            <input type="url" placeholder="Join link (optional)" value={meetingLink} onChange={e => setMeetingLink(e.target.value)}
                                className="w-full rounded-xl border border-gray-100 bg-white px-3 py-2 text-sm font-bold focus:border-primary focus:outline-none" />
                            <button type="submit" disabled={addingMeeting} className="w-full py-2 bg-primary text-white text-xs font-black rounded-xl disabled:opacity-50 mt-2">
                                {addingMeeting ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" /> : 'Schedule'}
                            </button>
                        </form>
                    )}
                    <div className="space-y-3">
                        {(lead.meetings?.length ?? 0) === 0 && (
                            <p className="text-center text-xs text-gray-300 italic py-4">No meetings scheduled.</p>
                        )}
                        {lead.meetings?.map((m: any) => {
                            const mc = MEETING_STATUS_CONFIG[m.status] || MEETING_STATUS_CONFIG['Scheduled'];
                            const Icon = mc.icon;
                            return (
                                <div key={m._id} className="rounded-xl border border-gray-50 bg-gray-50/50 p-4">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="font-bold text-gray-900 text-sm truncate">{m.title}</p>
                                            <p className="text-xs font-medium text-gray-400 mt-0.5">
                                                {format(new Date(m.date), 'dd MMM yyyy, hh:mm a')}
                                            </p>
                                            {m.link && (
                                                <a href={m.link} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary hover:underline flex items-center gap-1 mt-1">
                                                    <Video className="h-3 w-3" /> Join
                                                </a>
                                            )}
                                        </div>
                                        <div className={`shrink-0 h-7 w-7 rounded-lg flex items-center justify-center ${mc.bg}`}>
                                            <Icon className={`h-3.5 w-3.5 ${mc.color}`} />
                                        </div>
                                    </div>
                                    <div className="mt-2 flex gap-1.5 flex-wrap">
                                        {['Completed', 'Rescheduled', 'Cancelled'].map(s => (
                                            <button key={s} onClick={() => handleUpdateMeetingStatus(m._id, s)} disabled={m.status === s}
                                                className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg transition-colors disabled:opacity-30 ${s === 'Completed' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' :
                                                    s === 'Rescheduled' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' :
                                                        'bg-red-100 text-red-700 hover:bg-red-200'
                                                    }`}>
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
        </div>
        
    );
}

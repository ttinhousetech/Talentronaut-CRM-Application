import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Lead from '@/models/Lead';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Notification from '@/models/Notification';
import { syncMeetingToCalendar } from '@/lib/calendarSyncService';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: RouteParams) {
    try {
        await dbConnect();
        const { id } = await params;

        let lead;
        try {
            lead = await Lead.findById(id)
                .populate('assignedTo', 'name email')
                .populate('source', 'name')
                .populate('remarks.addedBy', 'name');
        } catch {
            lead = await Lead.findById(id)
                .populate('assignedTo', 'name email')
                .populate('source', 'name');
        }

        if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        return NextResponse.json({ lead });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: Request, { params }: RouteParams) {
    try {
        await dbConnect();
        const { id } = await params;
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();

        // Handle adding a remark (push to array)
        if (body.addRemark) {
            const sessionUser = session.user as any;
            const remark = {
                ...body.addRemark,
                addedBy: sessionUser?.id,
                addedByName: session.user?.name,
            };
            const lead = await Lead.findByIdAndUpdate(
                id,
                { $push: { remarks: remark } },
                { new: true }
            ).populate('assignedTo', 'name email').populate('remarks.addedBy', 'name');
            return NextResponse.json({ lead });
        }

        // Handle adding a meeting (push to array)
        if (body.addMeeting) {
            let meetingLink = body.addMeeting.link;
            
            // Auto-generate a video link if left blank
            if (!meetingLink) {
                const randomCode = Math.random().toString(36).substring(2, 11).match(/.{1,3}/g)?.join('-');
                meetingLink = `https://meet.google.com/${randomCode || 'crm-meet-link'}`;
            }

            const meetingData = {
                ...body.addMeeting,
                link: meetingLink
            };

            // Bidirectional Calendar Sync (Simulated)
            if (meetingData.hostId) {
                await syncMeetingToCalendar(
                    'google', 
                    meetingData.hostId, 
                    meetingData.title, 
                    new Date(meetingData.date), 
                    meetingLink
                );
            }

            const lead = await Lead.findByIdAndUpdate(
                id,
                { $push: { meetings: meetingData } },
                { new: true }
            ).populate('assignedTo', 'name email');
            return NextResponse.json({ lead });
        }

        // Handle updating a meeting status
        if (body.updateMeeting) {
            const { meetingId, status, notes } = body.updateMeeting;
            const lead = await Lead.findOneAndUpdate(
                { _id: id, 'meetings._id': meetingId },
                { $set: { 'meetings.$.status': status, 'meetings.$.notes': notes } },
                { new: true }
            ).populate('assignedTo', 'name email');
            return NextResponse.json({ lead });
        }

        // General field update (status, assignedTo, value, etc.)
        const oldLead = await Lead.findById(id);
        const isNewAssignment = body.assignedTo && oldLead && String(oldLead.assignedTo) !== String(body.assignedTo);

        const lead = await Lead.findByIdAndUpdate(
            id,
            { $set: body },
            { new: true, runValidators: true }
        ).populate('assignedTo', 'name email').populate('source', 'name');

        if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

        if (isNewAssignment) {
            await Notification.create({
                userId: body.assignedTo,
                title: `New Lead Assigned: ${lead.firstName} ${lead.lastName}`,
                message: `You have been assigned a new lead.`,
                type: 'Lead',
                link: '/sales/leads'
            });
        }

        // Trigger-Based Action: Proposal Sent Follow-up Task
        if (body.status === 'Proposal Sent' && oldLead && oldLead.status !== 'Proposal Sent') {
            const followUpDate = new Date();
            followUpDate.setDate(followUpDate.getDate() + 3);
            
            const systemRemark = {
                note: `[System Task] Proposal Sent. Follow up with the client on ${followUpDate.toLocaleDateString()}.`,
                method: 'Other',
                addedByName: 'System Automation',
            };

            await Lead.findByIdAndUpdate(id, { $push: { remarks: systemRemark } });
            lead.remarks.push(systemRemark as any); // Update local object for response
            
            if (lead.assignedTo) {
                await Notification.create({
                    userId: lead.assignedTo._id || lead.assignedTo,
                    title: `Follow-up Task Created`,
                    message: `A follow-up task was auto-created for ${lead.firstName} ${lead.lastName} (Proposal Sent).`,
                    type: 'System',
                    link: `/sales/leads/${lead._id}`
                });
            }
        }

        return NextResponse.json({ lead });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}

export async function DELETE(req: Request, { params }: RouteParams) {
    try {
        await dbConnect();
        const { id } = await params;
        const session = await getServerSession(authOptions);
        if (!session || session.user?.role !== 'Admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        await Lead.findByIdAndDelete(id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

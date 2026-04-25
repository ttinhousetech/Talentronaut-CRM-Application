import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Lead from '@/models/Lead';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Notification from '@/models/Notification';

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
            const lead = await Lead.findByIdAndUpdate(
                id,
                { $push: { meetings: body.addMeeting } },
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

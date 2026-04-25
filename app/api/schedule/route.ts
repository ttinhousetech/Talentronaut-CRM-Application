import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Lead from '@/models/Lead';

export async function POST(req: Request) {
    try {
        await dbConnect();
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const data = await req.json();
        const { leadId, title, date, link, notes, hostId } = data;

        if (!leadId || !title || !date || !hostId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Add meeting to lead
        const updatedLead = await Lead.findByIdAndUpdate(
            leadId,
            {
                $push: {
                    meetings: {
                        title,
                        date: new Date(date),
                        link,
                        notes,
                        hostId,
                        schedulerId: (session.user as any).id,
                        status: 'Scheduled'
                    }
                },
                status: 'Contacted' // Automatically update status
            },
            { new: true }
        );

        if (!updatedLead) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Meeting scheduled successfully', lead: updatedLead });

    } catch (error) {
        console.error('Schedule Meeting Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to schedule meeting' },
            { status: 500 }
        );
    }
}

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Lead from '@/models/Lead';
import '@/models/Source';
import { startOfDay, endOfDay } from 'date-fns';
import mongoose from 'mongoose';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await dbConnect();

        const userId = (session.user as any).id;
        const role = (session.user as any).role;
        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());

        let resultData: any = { role };

        if (role === 'Admin') {
            // Admin View
            const activeLeads = await Lead.find({
                status: { $in: ['New', 'Contacted', 'Qualified'] }
            }).sort({ updatedAt: -1 }).limit(15).populate('source');

            const totalAssigned = await Lead.countDocuments({ assignedTo: { $ne: null } });
            const unassigned = await Lead.countDocuments({ assignedTo: null });
            const convertedLeads = await Lead.countDocuments({ status: 'Won' });

            resultData.activeLeads = activeLeads;
            resultData.stats = { totalAssigned, unassigned, convertedLeads };
        }
        else if (role === 'Lead') {
            // Sales Leader View
            const objectIdUserId = new mongoose.Types.ObjectId(userId);

            // Find leads that have meetings hosted by this leader today
            const leadsWithMeetings = await Lead.find({
                'meetings.hostId': objectIdUserId,
                'meetings.date': { $gte: todayStart, $lte: todayEnd }
            });

            // Extract just the meetings for today
            let todayMeetings: any[] = [];
            leadsWithMeetings.forEach(lead => {
                const meetings = lead.meetings.filter(m =>
                    m.hostId?.toString() === userId &&
                    new Date(m.date) >= todayStart &&
                    new Date(m.date) <= todayEnd
                );
                meetings.forEach(m => todayMeetings.push({ ...(m as any).toObject?.() || m, leadId: lead._id, leadName: `${lead.firstName} ${lead.lastName}` }));
            });

            resultData.todayMeetings = todayMeetings;
            resultData.stats = { meetingsToday: todayMeetings.length };
        }
        else {
            // Member View (Default Sales Person)
            const assignedToday = await Lead.find({
                assignedTo: userId,
                createdAt: { $gte: todayStart, $lte: todayEnd }
            }).populate('source');

            const activeLeads = await Lead.find({
                assignedTo: userId,
                status: { $in: ['New', 'Contacted', 'Qualified'] }
            }).sort({ updatedAt: -1 }).limit(10).populate('source');

            const unassignedLeads = await Lead.find({
                assignedTo: null,
                status: 'New'
            }).sort({ createdAt: -1 }).limit(10);

            const stats = {
                totalAssigned: await Lead.countDocuments({ assignedTo: userId }),
                convertedLeads: await Lead.countDocuments({ assignedTo: userId, status: 'Won' }),
                leadsToday: assignedToday.length
            };

            resultData.assignedToday = assignedToday;
            resultData.activeLeads = activeLeads;
            resultData.unassignedLeads = unassignedLeads;
            resultData.stats = stats;
        }

        // Add some dummy notifications based on role
        resultData.notifications = [
            { id: 1, type: 'info', message: `Welcome to your ${role} Dashboard!`, time: 'Just now' },
        ];

        return NextResponse.json(resultData);

    } catch (error: any) {
        console.error('Sales stats aggregation error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

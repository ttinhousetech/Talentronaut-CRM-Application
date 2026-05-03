import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Lead from '@/models/Lead';
import Notification from '@/models/Notification';
import User from '@/models/User';

export async function GET(req: Request) {
    try {
        await dbConnect();

        // Check if the request is authorized (Optional: require a secret token in production)
        const authHeader = req.headers.get('authorization');
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const twoHoursAgo = new Date();
        twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

        // Find leads that are 'New' or 'In Progress' and haven't been updated in the last 2 hours
        const stalledLeads = await Lead.find({
            status: { $in: ['New', 'In Progress'] },
            updatedAt: { $lt: twoHoursAgo }
        }).populate('assignedTo', 'name email');

        if (stalledLeads.length === 0) {
            return NextResponse.json({ success: true, message: 'No stalled leads found.' });
        }

        let notificationsSent = 0;

        for (const lead of stalledLeads) {
            // Send SLA alert to assigned user
            if (lead.assignedTo) {
                const assignedUserId = lead.assignedTo._id || lead.assignedTo;
                
                // Avoid spamming if we already sent a notification recently (simplified for this feature, ideally we'd track SLA alert status)
                // For now, we will just send it if it's currently stalled
                
                await Notification.create({
                    userId: assignedUserId,
                    title: `SLA Alert: Lead Stalled`,
                    message: `Lead ${lead.firstName} ${lead.lastName} has been in "${lead.status}" status for over 2 hours. Please follow up.`,
                    type: 'System',
                    link: `/sales/leads/${lead._id}`
                });
                
                // Also update lead's remark with an SLA warning
                const slaRemark = {
                    note: `[SLA Warning] Lead has been ${lead.status} for >2 hours without an update.`,
                    method: 'Other',
                    addedByName: 'System Automation',
                };
                
                await Lead.findByIdAndUpdate(lead._id, { 
                    $push: { remarks: slaRemark },
                    $set: { updatedAt: new Date() } // Update the updatedAt so it doesn't trigger again immediately
                });

                notificationsSent++;
            }
        }

        return NextResponse.json({ success: true, notificationsSent });

    } catch (error: any) {
        console.error('SLA Check Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Lead from '@/models/Lead';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendEmailNotification } from '@/lib/emailService';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteParams) {
    try {
        await dbConnect();
        const { id } = await params;
        const session = await getServerSession(authOptions);
        
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { method, subject, message } = body;

        if (!method || !message) {
            return NextResponse.json({ error: 'Method and message are required' }, { status: 400 });
        }

        const lead = await Lead.findById(id);
        if (!lead) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        let deliveryStatus = 'Sent';
        let errorMessage = '';

        // 1. Process based on Method (Omnichannel Simulation)
        if (method === 'Email') {
            if (!lead.email) {
                return NextResponse.json({ error: 'Lead has no email address' }, { status: 400 });
            }
            try {
                // Assuming SES is configured or simulated
                await sendEmailNotification(
                    [lead.email],
                    subject || 'Update from Talentronaut',
                    `<div style="white-space: pre-wrap;">${message}</div>`
                );
            } catch (error: any) {
                console.error('Email send failed:', error);
                deliveryStatus = 'Failed';
                errorMessage = error.message;
            }
        } else if (method === 'WhatsApp') {
            if (!lead.phone) {
                return NextResponse.json({ error: 'Lead has no phone number' }, { status: 400 });
            }
            // WhatsApp Business API Integration would go here.
            // e.g. await sendWhatsAppMessage(lead.phone, message);
            // Simulating API latency
            await new Promise(resolve => setTimeout(resolve, 500));
            console.log(`[Simulated WhatsApp] Sent to ${lead.phone}: ${message}`);
        }

        // 2. Log the communication in the Lead's remarks (CRM functionality)
        const sessionUser = session.user as any;
        const notePrefix = subject ? `Subject: ${subject}\n\n` : '';
        const fullNote = `${notePrefix}${message}${errorMessage ? `\n\n[Delivery Failed: ${errorMessage}]` : ''}`;

        const newRemark = {
            note: fullNote,
            method: method,
            lastContactedDate: new Date(),
            addedBy: sessionUser?.id,
            addedByName: sessionUser?.name,
        };

        const updatedLead = await Lead.findByIdAndUpdate(
            id,
            { 
                $push: { remarks: newRemark },
                $set: { status: lead.status === 'New' ? 'Contacted' : lead.status } // Auto-update status
            },
            { new: true }
        ).populate('assignedTo', 'name email').populate('remarks.addedBy', 'name');

        return NextResponse.json({ 
            success: deliveryStatus === 'Sent', 
            lead: updatedLead 
        }, { status: deliveryStatus === 'Sent' ? 200 : 500 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

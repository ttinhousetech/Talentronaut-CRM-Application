import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Lead from '@/models/Lead';
import Source from '@/models/Source';
import '@/models/User';   // register for Lead.populate
import { assignLeadToSalesPerson } from '@/lib/leadRoutingService';


export async function GET(req: Request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const sourceId = searchParams.get('sourceId');
        const campaignId = searchParams.get('campaignId');

        let query = {};
        if (sourceId) {
            query = { source: sourceId };
        } else if (campaignId) {
            const sources = await Source.find({ campaign: campaignId }).select('_id');
            query = { source: { $in: sources.map((source) => source._id) } };
        }

        const leads = await Lead.find(query)
            .populate('assignedTo', 'name email')
            .populate('source', 'name')
            .sort({ createdAt: -1 });

        return NextResponse.json({ leads });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch leads';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const body = await req.json();
        const lead = await Lead.create(body);
        if (!body.assignedTo) {
            await assignLeadToSalesPerson(lead._id);
        }
        return NextResponse.json({ lead }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create lead';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

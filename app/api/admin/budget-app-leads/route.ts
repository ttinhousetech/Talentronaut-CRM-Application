import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Lead from '@/models/Lead';
import Source from '@/models/Source';
import Campaign from '@/models/Campaign';
import Subdomain from '@/models/Subdomain';
import Domain from '@/models/Domain';

const BUDGET_DOMAIN_NAME = 'Talentronaut-budget-application-leads';

export async function GET() {
    try {
        await dbConnect();

        const domain = await Domain.findOne({ name: BUDGET_DOMAIN_NAME });
        if (!domain) {
            return NextResponse.json({ leads: [], total: 0 });
        }

        const subdomains = await Subdomain.find({ domain: domain._id }).select('_id');
        if (subdomains.length === 0) {
            return NextResponse.json({ leads: [], total: 0 });
        }

        const campaigns = await Campaign.find({
            subdomain: { $in: subdomains.map((s) => s._id) },
        }).select('_id');

        if (campaigns.length === 0) {
            return NextResponse.json({ leads: [], total: 0 });
        }

        const sources = await Source.find({
            campaign: { $in: campaigns.map((c) => c._id) },
        }).select('_id');

        const query = sources.length > 0 ? { source: { $in: sources.map((s) => s._id) } } : {};

        const leads = await Lead.find(query)
            .populate('assignedTo', 'name email')
            .populate('source', 'name')
            .sort({ createdAt: -1 });

        return NextResponse.json({ leads, total: leads.length });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch budget app leads';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

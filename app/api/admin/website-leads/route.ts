import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Lead from '@/models/Lead';
import Source from '@/models/Source';
import Campaign from '@/models/Campaign';
import Subdomain from '@/models/Subdomain';
import Domain from '@/models/Domain';

const WEBSITE_DOMAIN_NAME = 'Talentronaut Website';

const SERVICES = [
    'Technical Solutions',
    'Enterprise Operation',
    'Talent Hire',
    'Consultation',
    'Bespoke Solution',
];

export async function GET(req: Request) {
    try {
        await dbConnect();

        const { searchParams } = new URL(req.url);
        const serviceFilter = searchParams.get('service'); // optional subdomain filter

        const domain = await Domain.findOne({ name: WEBSITE_DOMAIN_NAME });
        if (!domain) {
            return NextResponse.json({ leads: [], total: 0, services: SERVICES });
        }

        // Optionally filter to a specific subdomain (service)
        const subdomainQuery = serviceFilter
            ? { domain: domain._id, name: serviceFilter }
            : { domain: domain._id };

        const subdomains = await Subdomain.find(subdomainQuery).select('_id name');
        if (subdomains.length === 0) {
            return NextResponse.json({ leads: [], total: 0, services: SERVICES });
        }

        const campaigns = await Campaign.find({
            subdomain: { $in: subdomains.map((s) => s._id) },
        }).select('_id');

        if (campaigns.length === 0) {
            return NextResponse.json({ leads: [], total: 0, services: SERVICES });
        }

        const sources = await Source.find({
            campaign: { $in: campaigns.map((c) => c._id) },
        }).select('_id');

        const query = sources.length > 0
            ? { source: { $in: sources.map((s) => s._id) } }
            : {};

        const leads = await Lead.find(query)
            .populate('assignedTo', 'name email')
            .populate('source', 'name')
            .sort({ createdAt: -1 });

        return NextResponse.json({ leads, total: leads.length, services: SERVICES });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch website leads';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

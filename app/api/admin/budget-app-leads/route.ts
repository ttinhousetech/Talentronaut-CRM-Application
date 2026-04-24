import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Lead from '@/models/Lead';
import Source from '@/models/Source';
import Campaign from '@/models/Campaign';
import Subdomain from '@/models/Subdomain';
import Domain from '@/models/Domain';

const BUDGET_APP_NAME = 'Budget App';
const BUDGET_FORM_ID = 'budget-campaign';
const BUDGET_FORM_NAME = 'Budget Campaign Report Modal';

export async function GET() {
    try {
        await dbConnect();

        // Budget leads are written with explicit payload fields, so query those
        // first instead of depending on a brittle folder-name lookup.
        const directLeads = await Lead.find({
            $or: [
                { 'details.appName': BUDGET_APP_NAME },
                { 'details.formId': BUDGET_FORM_ID },
                { 'details.formName': BUDGET_FORM_NAME },
            ],
        })
            .populate('assignedTo', 'name email')
            .populate('source', 'name')
            .sort({ createdAt: -1 });

        if (directLeads.length > 0) {
            return NextResponse.json({ leads: directLeads, total: directLeads.length });
        }

        // Fallback for any older leads that may only exist through taxonomy.
        const domain = await Domain.findOne({ name: 'Budget App' });
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

        const sources = await Source.find({
            campaign: { $in: campaigns.map((c) => c._id) },
        }).select('_id');

        const query = sources.length > 0
            ? {
                $or: [
                    { source: { $in: sources.map((s) => s._id) } },
                    { 'details.appName': BUDGET_APP_NAME },
                ],
            }
            : { 'details.appName': BUDGET_APP_NAME };

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

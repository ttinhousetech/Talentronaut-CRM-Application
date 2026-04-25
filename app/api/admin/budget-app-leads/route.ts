import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Lead from '@/models/Lead';
import Source from '@/models/Source';
import Campaign from '@/models/Campaign';
import Subdomain from '@/models/Subdomain';
import Domain from '@/models/Domain';
import '@/models/User';

const BUDGET_APP_NAME = 'Budget App';
const BUDGET_FORM_ID = 'budget-campaign';
const BUDGET_FORM_NAME = 'Budget Campaign Report Modal';
const BUDGET_SOURCE_URL_PATTERN = /campaign\.talentronaut\.in/i;
const BUDGET_DOMAIN_NAMES = ['Budget App', 'Talentronaut-budget-application-leads'];
const BUDGET_SUBDOMAIN_NAMES = ['Budget Campaign Forms'];
const BUDGET_CAMPAIGN_NAMES = ['Budget Campaign'];
const BUDGET_SOURCE_NAMES = ['campaign.talentronaut.in', 'Project Report Modal'];

function buildBudgetLeadQuery(sourceIds: string[] = []) {
    return {
        $or: [
            { 'details.appName': BUDGET_APP_NAME },
            { 'details.formId': BUDGET_FORM_ID },
            { 'details.formName': BUDGET_FORM_NAME },
            { sourceUrl: BUDGET_SOURCE_URL_PATTERN },
            ...(sourceIds.length > 0 ? [{ source: { $in: sourceIds } }] : []),
        ],
    };
}

export async function GET() {
    try {
        await dbConnect();

        // Budget leads are written with explicit payload fields. Query those first,
        // then fall back to the historical taxonomy paths so older records stay visible.
        const directLeads = await Lead.find(buildBudgetLeadQuery())
            .populate('assignedTo', 'name email')
            .populate('source', 'name')
            .sort({ createdAt: -1 });

        if (directLeads.length > 0) {
            return NextResponse.json({ leads: directLeads, total: directLeads.length });
        }

        // Fallback for any older leads that may only exist through taxonomy.
        const domains = await Domain.find({ name: { $in: BUDGET_DOMAIN_NAMES } }).select('_id');
        if (domains.length === 0) {
            return NextResponse.json({ leads: [], total: 0 });
        }

        const subdomains = await Subdomain.find({
            domain: { $in: domains.map((domain) => domain._id) },
            name: { $in: BUDGET_SUBDOMAIN_NAMES },
        }).select('_id');
        if (subdomains.length === 0) {
            return NextResponse.json({ leads: [], total: 0 });
        }

        const campaigns = await Campaign.find({
            subdomain: { $in: subdomains.map((s) => s._id) },
            name: { $in: BUDGET_CAMPAIGN_NAMES },
        }).select('_id');
        if (campaigns.length === 0) {
            return NextResponse.json({ leads: [], total: 0 });
        }

        const sources = await Source.find({
            campaign: { $in: campaigns.map((c) => c._id) },
            name: { $in: BUDGET_SOURCE_NAMES },
        }).select('_id');

        const query = buildBudgetLeadQuery(sources.map((source) => source._id.toString()));

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

import type { Types } from 'mongoose';
import dbConnect from '@/lib/db';
import Campaign from '@/models/Campaign';
import Domain from '@/models/Domain';
import Lead from '@/models/Lead';
import Notification from '@/models/Notification';
import Project from '@/models/Project';
import Source from '@/models/Source';
import Subdomain from '@/models/Subdomain';
import User from '@/models/User';

const DEFAULT_TAXONOMY = {
    projectName: 'Talentronaut',
    domainName: 'Website Leads',
    subdomainName: 'Website Forms',
    campaignName: 'Inbound Forms',
    sourceName: 'External Website',
};

const VALID_SOURCE_TYPES = ['Website', 'Meta', 'Manual', 'Other'] as const;
type SourceType = typeof VALID_SOURCE_TYPES[number];

type FormDetails = Record<string, unknown>;
type Taxonomy = typeof DEFAULT_TAXONOMY;

const ROUTING_RULES: Array<{
    matches: (context: { formId: string; sourceUrl: string; hostname: string; productName: string }) => boolean;
    taxonomy: Taxonomy;
}> = [
    {
        matches: ({ formId, hostname, productName }) =>
            formId.includes('budget') ||
            productName.includes('budget') ||
            hostname === 'campaign.talentronaut.in',
        taxonomy: {
            projectName: 'Talentronaut',
            domainName: 'Budget App',
            subdomainName: 'Lead Forms',
            campaignName: 'Budget Campaign',
            sourceName: 'Project Report Modal',
        },
    },
    {
        matches: ({ formId, sourceUrl, hostname }) =>
            formId.includes('contact') &&
            (hostname === 'talentronaut.in' ||
                hostname === 'www.talentronaut.in' ||
                sourceUrl.includes('talentronaut')),
        taxonomy: {
            projectName: 'Talentronaut',
            domainName: 'Talentronaut Website',
            subdomainName: 'Contact Forms',
            campaignName: 'Contact Us',
            sourceName: 'Main Website Contact Form',
        },
    },
    {
        matches: ({ sourceUrl, hostname, productName }) =>
            productName.includes('linksus') ||
            hostname.includes('linksus') ||
            sourceUrl.includes('linksus'),
        taxonomy: {
            projectName: 'LinksUs',
            domainName: 'LinksUs Website',
            subdomainName: 'Contact Forms',
            campaignName: 'Contact Us',
            sourceName: 'LinksUs Contact Form',
        },
    },
];

export interface LeadIngestionPayload {
    appName?: string;
    formId?: string;
    formName?: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    email: string;
    phone?: string;
    whatsapp?: string;
    company?: string;
    sourceType?: SourceType;
    sourceUrl?: string;
    projectName?: string;
    domainName?: string;
    subdomainName?: string;
    campaignName?: string;
    sourceName?: string;
    details?: FormDetails;
}

function cleanString(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(email: string) {
    return email.trim().toLowerCase();
}

function getHostname(sourceUrl: string) {
    try {
        return new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
        return '';
    }
}

function toTitleCase(value: string) {
    return value
        .replace(/^www\./, '')
        .replace(/\.[a-z]{2,}(\.[a-z]{2,})?$/i, '')
        .replace(/[-_.]+/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

function splitName(payload: LeadIngestionPayload) {
    const firstName = cleanString(payload.firstName);
    const lastName = cleanString(payload.lastName);

    if (firstName) {
        return { firstName, lastName: lastName || '-' };
    }

    const fullName = cleanString(payload.fullName);
    const parts = fullName.split(/\s+/).filter(Boolean);
    return {
        firstName: parts[0] || 'Unknown',
        lastName: parts.slice(1).join(' ') || '-',
    };
}

function getTaxonomy(payload: LeadIngestionPayload) {
    const formId = cleanString(payload.formId).toLowerCase();
    const sourceUrl = cleanString(payload.sourceUrl).toLowerCase();
    const productName = (cleanString(payload.appName) || cleanString(payload.formName)).toLowerCase();
    const hostname = getHostname(sourceUrl);
    const matchedRule = ROUTING_RULES.find((rule) => rule.matches({ formId, sourceUrl, hostname, productName }));
    const derivedName = cleanString(payload.appName) || cleanString(payload.formName) || toTitleCase(hostname);

    const base = matchedRule?.taxonomy || {
        ...DEFAULT_TAXONOMY,
        domainName: derivedName ? `${derivedName} Leads` : DEFAULT_TAXONOMY.domainName,
        campaignName: cleanString(payload.formName) || DEFAULT_TAXONOMY.campaignName,
        sourceName: hostname || DEFAULT_TAXONOMY.sourceName,
    };

    return {
        projectName: cleanString(payload.projectName) || base.projectName,
        domainName: cleanString(payload.domainName) || base.domainName,
        subdomainName: cleanString(payload.subdomainName) || base.subdomainName,
        campaignName: cleanString(payload.campaignName) || base.campaignName,
        sourceName: cleanString(payload.sourceName) || base.sourceName,
    };
}

function getSourceType(sourceType: unknown): SourceType {
    return VALID_SOURCE_TYPES.includes(sourceType as SourceType)
        ? sourceType as SourceType
        : 'Website';
}

async function findOrCreateProject(name: string) {
    return Project.findOneAndUpdate(
        { name },
        { $setOnInsert: { name, status: 'Active' } },
        { upsert: true, new: true }
    );
}

async function findOrCreateDomain(name: string, projectId: Types.ObjectId) {
    return Domain.findOneAndUpdate(
        { name, project: projectId },
        { $setOnInsert: { name, project: projectId, status: 'Active' } },
        { upsert: true, new: true }
    );
}

async function findOrCreateSubdomain(name: string, domainId: Types.ObjectId) {
    return Subdomain.findOneAndUpdate(
        { name, domain: domainId },
        { $setOnInsert: { name, domain: domainId, status: 'Active' } },
        { upsert: true, new: true }
    );
}

async function findOrCreateCampaign(name: string, subdomainId: Types.ObjectId) {
    return Campaign.findOneAndUpdate(
        { name, subdomain: subdomainId },
        { $setOnInsert: { name, subdomain: subdomainId, status: 'Active' } },
        { upsert: true, new: true }
    );
}

async function findOrCreateSource(name: string, campaignId: Types.ObjectId, type: SourceType) {
    return Source.findOneAndUpdate(
        { name, campaign: campaignId },
        { $setOnInsert: { name, campaign: campaignId, type, status: 'Active' } },
        { upsert: true, new: true }
    );
}

function buildSubmissionNote(payload: LeadIngestionPayload) {
    const lines = [
        `Form Submission: ${cleanString(payload.formName) || cleanString(payload.formId) || 'External Form'}`,
    ];

    if (payload.phone) lines.push(`Phone: ${payload.phone}`);
    if (payload.whatsapp) lines.push(`WhatsApp: ${payload.whatsapp}`);
    if (payload.sourceUrl) lines.push(`Source URL: ${payload.sourceUrl}`);

    if (payload.details && Object.keys(payload.details).length > 0) {
        lines.push('Details:');
        for (const [key, value] of Object.entries(payload.details)) {
            if (value === undefined || value === null || value === '') continue;
            lines.push(`${key}: ${String(value)}`);
        }
    }

    return lines.join('\n');
}

async function notifyTeam(leadId: Types.ObjectId, firstName: string, lastName: string, sourceName: string) {
    const usersToNotify = await User.find({
        role: { $in: ['Admin', 'Lead', 'Member'] },
        status: { $ne: 'Inactive' },
    });

    if (usersToNotify.length === 0) return;

    await Notification.insertMany(usersToNotify.map((user) => ({
        userId: user._id,
        title: `New Lead: ${firstName} ${lastName}`.trim(),
        message: `A new inbound lead arrived from ${sourceName}.`,
        type: 'Lead',
        link: `/admin/leads/${leadId}`,
    })));
}

export async function ingestExternalLead(payload: LeadIngestionPayload) {
    const email = normalizeEmail(payload.email || '');
    if (!email) {
        throw new Error('email is required.');
    }

    const { firstName, lastName } = splitName(payload);
    if (!firstName || firstName === 'Unknown') {
        throw new Error('fullName or firstName is required.');
    }

    await dbConnect();

    const sourceType = getSourceType(payload.sourceType);
    const taxonomy = getTaxonomy(payload);

    const project = await findOrCreateProject(taxonomy.projectName);
    const domain = await findOrCreateDomain(taxonomy.domainName, project._id);
    const subdomain = await findOrCreateSubdomain(taxonomy.subdomainName, domain._id);
    const campaign = await findOrCreateCampaign(taxonomy.campaignName, subdomain._id);
    const source = await findOrCreateSource(taxonomy.sourceName, campaign._id, sourceType);
    const note = buildSubmissionNote(payload);

    const existingLead = await Lead.findOne({ email });
    if (existingLead) {
        existingLead.set({
            phone: cleanString(payload.phone) || existingLead.phone,
            sourceType,
            sourceUrl: cleanString(payload.sourceUrl) || existingLead.sourceUrl,
            source: source._id,
            details: {
                ...(existingLead.details ? Object.fromEntries(existingLead.details) : {}),
                ...(payload.details || {}),
                formId: cleanString(payload.formId) || undefined,
                formName: cleanString(payload.formName) || undefined,
                whatsapp: cleanString(payload.whatsapp) || undefined,
            },
        });
        existingLead.remarks.push({
            note,
            method: 'Other',
            addedByName: cleanString(payload.formName) || 'External Form',
        } as never);
        await existingLead.save();

        return {
            lead: existingLead,
            created: false,
            taxonomy,
        };
    }

    const lead = await Lead.create({
        firstName,
        lastName,
        email,
        phone: cleanString(payload.phone) || undefined,
        company: cleanString(payload.company) || undefined,
        sourceType,
        sourceUrl: cleanString(payload.sourceUrl) || undefined,
        source: source._id,
        status: 'New',
        value: 0,
        details: {
            ...(payload.details || {}),
            formId: cleanString(payload.formId) || undefined,
            formName: cleanString(payload.formName) || undefined,
            whatsapp: cleanString(payload.whatsapp) || undefined,
        },
        remarks: [{
            note,
            method: 'Other',
            addedByName: cleanString(payload.formName) || 'External Form',
        }],
    });

    await notifyTeam(lead._id, firstName, lastName, taxonomy.sourceName);

    return {
        lead,
        created: true,
        taxonomy,
    };
}

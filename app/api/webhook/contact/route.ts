import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Lead from '@/models/Lead';
import Source from '@/models/Source';
import Campaign from '@/models/Campaign';
import Subdomain from '@/models/Subdomain';
import Domain from '@/models/Domain';
import Project from '@/models/Project';
import User from '@/models/User';
import Notification from '@/models/Notification';
import { sendEmailNotification } from '@/lib/emailService';
import { assignLeadToSalesPerson } from '@/lib/leadRoutingService';

// ─── CORS headers for cross-origin requests from the public website ───
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',          // tighten to your website domain in production
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Pre-flight (OPTIONS) – browsers send this before POST from a different origin
export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// ─── Taxonomy Mapping ────────────────────────────────────────────────────────
const TAXONOMY_MAP: { keywords: string[]; project: string; domain: string; subdomain: string; campaign: string }[] = [
    {
        keywords: ['ai', 'ml', 'machine learning', 'artificial intelligence', 'chatbot', 'automation', 'nlp', 'talentronaut', 'crm'],
        project: 'Talentronaut',
        domain: 'AI & SaaS Solutions',
        subdomain: 'SaaS Products',
        campaign: 'Inbound Enquiries',
    },
    {
        keywords: ['web', 'website', 'app', 'application', 'software', 'development', 'mobile', 'linksus'],
        project: 'LinksUs',
        domain: 'Development Services',
        subdomain: 'Web & App Development',
        campaign: 'Website Leads',
    }
];

const DEFAULT_PROJECT = 'Talentronaut';
const DEFAULT_DOMAIN = 'General Enquiries';
const DEFAULT_SUBDOMAIN = 'General';
const DEFAULT_CAMPAIGN = 'Website Enquiries';
const SOURCE_NAME = 'Company Website';

function mapSubjectToHierarchy(text: string): { project: string; domain: string; subdomain: string; campaign: string } {
    const lower = text.toLowerCase();
    for (const entry of TAXONOMY_MAP) {
        if (entry.keywords.some(kw => lower.includes(kw))) {
            return { project: entry.project, domain: entry.domain, subdomain: entry.subdomain, campaign: entry.campaign };
        }
    }
    return { project: DEFAULT_PROJECT, domain: DEFAULT_DOMAIN, subdomain: DEFAULT_SUBDOMAIN, campaign: DEFAULT_CAMPAIGN };
}

// ─── Find or Create Helpers ─────────────────────────────────────────────────
async function findOrCreateProject(name: string) {
    return Project.findOneAndUpdate(
        { name },
        { $setOnInsert: { name, status: 'Active' } },
        { upsert: true, new: true }
    );
}

async function findOrCreateDomain(name: string, projectId: string) {
    return Domain.findOneAndUpdate(
        { name, project: projectId },
        { $setOnInsert: { name, project: projectId, status: 'Active' } },
        { upsert: true, new: true }
    );
}

async function findOrCreateSubdomain(name: string, domainId: string) {
    return Subdomain.findOneAndUpdate(
        { name, domain: domainId },
        { $setOnInsert: { name, domain: domainId, status: 'Active' } },
        { upsert: true, new: true }
    );
}

async function findOrCreateCampaign(name: string, subdomainId: string) {
    return Campaign.findOneAndUpdate(
        { name, subdomain: subdomainId },
        { $setOnInsert: { name, subdomain: subdomainId, status: 'Active' } },
        { upsert: true, new: true }
    );
}

async function findOrCreateSource(campaignId: string) {
    return Source.findOneAndUpdate(
        { name: SOURCE_NAME, campaign: campaignId },
        { $setOnInsert: { name: SOURCE_NAME, campaign: campaignId, type: 'Website', status: 'Active' } },
        { upsert: true, new: true }
    );
}// ─── Main POST handler ───────────────────────────────────────────────────────
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { fullName, email, phone, subject, message } = body;

        // Basic validation
        if (!fullName || !email) {
            return NextResponse.json(
                { success: false, error: 'fullName and email are required.' },
                { status: 400, headers: CORS_HEADERS }
            );
        }

        // Split full name into first / last
        const nameParts = String(fullName).trim().split(/\s+/);
        const firstName = nameParts[0] || 'Unknown';
        const lastName = nameParts.slice(1).join(' ') || '-';

        await dbConnect();

        // 1. Map content to hierarchy names
        const combinedText = `${subject || ''} ${message || ''}`;
        const taxonomy = mapSubjectToHierarchy(combinedText);

        // 2. Build the hierarchy top-down
        const projectDoc = await findOrCreateProject(taxonomy.project);
        const domainDoc = await findOrCreateDomain(taxonomy.domain, projectDoc._id.toString());
        const subdomainDoc = await findOrCreateSubdomain(taxonomy.subdomain, domainDoc._id.toString());
        const campaignDoc = await findOrCreateCampaign(taxonomy.campaign, subdomainDoc._id.toString());
        const sourceDoc = await findOrCreateSource(campaignDoc._id.toString());

        // 3. Create the lead directly using the new schema and link source
        const newLeadData: any = {
            firstName,
            lastName,
            email: String(email).toLowerCase().trim(),
            phone: phone || undefined,
            sourceType: 'Website',
            sourceUrl: 'Talentronaut Website',
            source: sourceDoc._id,
            status: 'New',
            value: 0,
        };

        if (subject || message) {
            newLeadData.remarks = [{
                note: `Contact Form Submission:\nSubject: ${subject || 'No Subject'}\nMessage: ${message || 'No Message'}`,
                method: 'Other',
                addedByName: 'Website Form',
            }];
        }

        const lead = await Lead.create(newLeadData);

        console.log(`✅ Webhook lead created: ${lead._id} appended to ${taxonomy.campaign}`);

        // 3.5 Intelligent Auto-Routing
        await assignLeadToSalesPerson(lead._id);

        // 4. Send Notifications (In-App & Email)
        try {
            // Find admins and sales team members to notify
            const usersToNotify = await User.find({ role: { $in: ['Admin', 'Lead', 'Member'] }, status: { $ne: 'Inactive' } });

            if (usersToNotify.length > 0) {
                const notificationsToInsert = usersToNotify.map(user => ({
                    userId: user._id,
                    title: `New Lead: ${firstName} ${lastName}`,
                    message: `A new lead just registered from the website.`,
                    type: 'Lead',
                    link: `/admin/leads/${lead._id}`,
                }));

                await Notification.insertMany(notificationsToInsert);

                const adminUsers = usersToNotify.filter(u => u.role === 'Admin');
                const adminEmails = adminUsers.map(a => a.email);

                // Only send emails to Admins to prevent spamming sales floor
                if (adminEmails.length > 0) {
                    const emailHtml = `
                    <h2>New Lead Received!</h2>
                    <p><strong>Name:</strong> ${firstName} ${lastName}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <br/>
                    <a href="${process.env.NEXTAUTH_URL}/admin/leads/${lead._id}">Click here to view lead in CRM</a>
                `;

                    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
                        await sendEmailNotification(
                            adminEmails,
                            `New Lead Alert: ${firstName} ${lastName}`,
                            emailHtml
                        );
                    }
                }
            }
        } catch (notifErr) {
            console.error('Error sending lead notifications:', notifErr);
        }

        return NextResponse.json(
            {
                success: true,
                leadId: lead._id,
            },
            { status: 201, headers: CORS_HEADERS }
        );

    } catch (error: any) {
        console.error('❌ Webhook error:', error.message);
        return NextResponse.json(
            { success: false, error: 'Internal server error. Please try again.' },
            { status: 500, headers: CORS_HEADERS }
        );
    }
}

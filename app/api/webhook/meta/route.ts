import { NextResponse } from 'next/server';
import crypto from 'crypto';
import dbConnect from '@/lib/db';
import Lead from '@/models/Lead';
import Source from '@/models/Source';
import Campaign from '@/models/Campaign';
import Domain from '@/models/Domain';
import User from '@/models/User';
import Notification from '@/models/Notification';
import { sendEmailNotification } from '@/lib/emailService';
import { assignLeadToSalesPerson } from '@/lib/leadRoutingService';

// ─── Environment Variables (from .env.local) ───
const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || '';
const META_PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN || '';
// Optional: App Secret for hash verification if needed in production
const META_APP_SECRET = process.env.META_APP_SECRET || '';

// ─── Upsert helpers (find or create) ────────────────────────────────────────
async function findOrCreateDomain(name: string) {
    return Domain.findOneAndUpdate(
        { name },
        { $setOnInsert: { name, status: 'Active' } },
        { upsert: true, new: true }
    );
}

async function findOrCreateCampaign(name: string, domainId: string) {
    return Campaign.findOneAndUpdate(
        { name, domain: domainId },
        { $setOnInsert: { name, domain: domainId, status: 'Active' } },
        { upsert: true, new: true }
    );
}

async function findOrCreateSource(sourceName: string, campaignId: string) {
    return Source.findOneAndUpdate(
        { name: sourceName, campaign: campaignId },
        { $setOnInsert: { name: sourceName, campaign: campaignId, type: 'Social Media', status: 'Active' } },
        { upsert: true, new: true }
    );
}

// ─── Verification Endpoint (GET) ────────────────────────────────────────────
// Meta hits this URL whenever you set up or modify the Webhook in the App Dashboard.
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);

    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
        console.log('✅ Meta Webhook verified successfully.');
        // Meta expects the challenge to be returned as a plain text string
        return new NextResponse(challenge, { status: 200 });
    } else {
        console.error('❌ Meta Webhook verification failed. Token mismatch.');
        return new NextResponse('Forbidden', { status: 403 });
    }
}

// ─── Ingestion Endpoint (POST) ──────────────────────────────────────────────
export async function POST(req: Request) {
    try {
        // 1. Verify webhook signature (Optional but recommended for Production)
        // If META_APP_SECRET is provided, we should verify the X-Hub-Signature-256 header.
        if (META_APP_SECRET) {
            const signature = req.headers.get('x-hub-signature-256');
            if (!signature) {
                return new NextResponse('Missing signature', { status: 401 });
            }
            const rawBody = await req.text(); // Need raw text for HMAC
            const expectedSignature = `sha256=${crypto.createHmac('sha256', META_APP_SECRET).update(rawBody).digest('hex')}`;
            if (signature !== expectedSignature) {
                return new NextResponse('Invalid signature', { status: 401 });
            }
            // Parse body back to JSON for processing
            var body = JSON.parse(rawBody);
        } else {
            // Read body directly if no signature check
            var body = await req.json();
        }

        console.log('--- Incoming Meta Webhook ---');
        console.log(JSON.stringify(body, null, 2));

        // 2. Validate payload structure (Meta sends an 'object' and 'entry' array)
        if (body.object !== 'page') {
            return new NextResponse('Not a page event', { status: 404 });
        }

        // Processing multiple entries (Meta can batch updates)
        for (const entry of body.entry) {
            for (const change of entry.changes) {
                // Ensure this is a leadgen event
                if (change.field !== 'leadgen') continue;

                const leadgen_id = change.value.leadgen_id;
                const form_id = change.value.form_id;
                const page_id = change.value.page_id;
                const ad_id = change.value.ad_id;
                const ad_name = change.value.ad_name || 'Unknown Ad';
                const campaign_id = change.value.campaign_id;
                const campaign_name = change.value.campaign_name || 'Social Media Ads';

                console.log(`Processing Meta Lead ID: ${leadgen_id} from Campaign: ${campaign_name}`);

                // 3. Fetch Lead Details from Meta Graph API
                // Access Token must be a Page Access Token with 'leads_retrieval' permission.
                const graphApiUrl = `https://graph.facebook.com/v19.0/${leadgen_id}?access_token=${META_PAGE_ACCESS_TOKEN}`;

                let graphRes;
                try {
                    graphRes = await fetch(graphApiUrl);
                } catch (err) {
                    console.error('Error reaching Meta Graph API:', err);
                    continue;
                }

                if (!graphRes.ok) {
                    const errorData = await graphRes.json();
                    console.error(`❌ Meta Graph API Error for lead ${leadgen_id}:`, errorData);
                    continue;
                }

                const leadData = await graphRes.json();

                // 4. Map the Meta form field data to CRM parameters
                // Meta returns 'field_data' as an array of objects: [{ name: 'email', values: ['john@abc.com'] }]
                let extractedFullName = '';
                let extractedEmail = '';
                let extractedPhone = '';

                // Map common fields. (Marketing team needs to ensure these names exactly match their form setup)
                leadData.field_data.forEach((field: any) => {
                    const fieldName = field.name.toLowerCase();
                    const value = field.values[0] || '';

                    if (fieldName.includes('name')) extractedFullName = value;
                    if (fieldName.includes('email')) extractedEmail = value;
                    if (fieldName.includes('phone') || fieldName.includes('number')) extractedPhone = value;
                });

                if (!extractedFullName && !extractedEmail) {
                    console.warn(`Lead ${leadgen_id} lacks basic name/email fields, skipping DB creation.`);
                    continue;
                }

                // Split full name
                const nameParts = String(extractedFullName).trim().split(/\s+/);
                const firstName = nameParts[0] || 'Unknown';
                const lastName = nameParts.slice(1).join(' ') || '-';

                await dbConnect();

                // 5. Structure into Domain > Campaign > Source
                // We will create a default Domain for all Social Meta Leads
                const domainName = 'Social Media Marketing';
                const sourceName = `Meta Ads (${ad_name})`; // Using Ad Name as the 'Source'

                const domainDoc = await findOrCreateDomain(domainName);
                const campaignDoc = await findOrCreateCampaign(campaign_name, domainDoc._id.toString());
                const sourceDoc = await findOrCreateSource(sourceName, campaignDoc._id.toString());

                // 6. Save the Lead to Database
                const lead = await Lead.create({
                    firstName,
                    lastName,
                    email: String(extractedEmail).toLowerCase().trim(),
                    phone: extractedPhone || undefined,
                    company: undefined, // Usually missing unless specifically asked in form
                    source: sourceDoc._id,
                    status: 'New',
                    value: 0,
                    details: new Map(Object.entries({
                        submittedFrom: 'Meta Ad Form',
                        leadgen_id: leadgen_id,
                        ad_id: ad_id,
                        campaign_id: campaign_id,
                        form_id: form_id,
                        page_id: page_id,
                        submittedAt: new Date(leadData.created_time).toISOString(),
                    })),
                });

                console.log(`✅ Meta lead created: ${lead._id} | ${domainName} → ${campaign_name} → ${sourceName}`);

                // 6.5 Intelligent Auto-Routing
                await assignLeadToSalesPerson(lead._id);

                // 7. Send Notifications (In-App & Email)
                try {
                    // Notify any user mapped as Admin or Administrator
                    const admins = await User.find({ role: { $in: ['Admin', 'Administrator'] }, status: { $ne: 'Inactive' } });

                    if (admins.length > 0) {
                        const notificationsToInsert = admins.map(admin => ({
                            userId: admin._id,
                            title: `New Meta Lead: ${firstName} ${lastName}`,
                            message: `A new lead just registered via Facebook/Instagram ad: ${campaign_name}.`,
                            type: 'Lead',
                            link: `/admin/leads/${lead._id}`,
                        }));

                        await Notification.insertMany(notificationsToInsert);

                        const adminEmails = admins.map(a => a.email);
                        const emailHtml = `
                            <h2>New Meta Lead Received!</h2>
                            <p><strong>Name:</strong> ${firstName} ${lastName}</p>
                            <p><strong>Email:</strong> ${extractedEmail}</p>
                            <p><strong>Phone:</strong> ${extractedPhone}</p>
                            <p><strong>Campaign:</strong> ${campaign_name}</p>
                            <p><strong>Ad:</strong> ${ad_name}</p>
                            <br/>
                            <a href="${process.env.NEXTAUTH_URL}/admin/leads/${lead._id}">Click here to view lead in CRM</a>
                        `;

                        if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
                            await sendEmailNotification(
                                adminEmails,
                                `New Meta Lead: ${firstName} ${lastName}`,
                                emailHtml
                            );
                        }
                    }
                } catch (notifErr) {
                    console.error('Error sending Meta lead notifications:', notifErr);
                }
            }
        }

        // Return a 200 OK immediately as required by Meta guidelines, 
        // to prevent Meta from disabling the webhook stream due to timeouts.
        return new NextResponse('EVENT_RECEIVED', { status: 200 });

    } catch (error: any) {
        console.error('❌ Meta Webhook error:', error.message);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

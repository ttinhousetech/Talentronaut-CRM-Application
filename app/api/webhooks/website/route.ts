import { NextResponse } from 'next/server';
import { ingestExternalLead } from '@/lib/leadIngestion';

// ─── Service Configuration ───────────────────────────────────────────────────

const SERVICES: Record<string, { label: string; subdomainName: string }> = {
    'technical-solutions': { label: 'Technical Solutions', subdomainName: 'Technical Solutions' },
    'enterprise-operation': { label: 'Enterprise Operation', subdomainName: 'Enterprise Operation' },
    'talent-hire': { label: 'Talent Hire', subdomainName: 'Talent Hire' },
    'consultation': { label: 'Consultation', subdomainName: 'Consultation' },
    'bespoke-solution': { label: 'Bespoke Solution', subdomainName: 'Bespoke Solution' },
};

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const {
            service,
            fullName,
            firstName,
            lastName,
            email,
            phone,
            mobile,
            company,
            projectRequirements,
            message,
        } = body;

        // Validate service
        const serviceConfig = SERVICES[service as string];
        if (!serviceConfig) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Invalid service. Must be one of: ${Object.keys(SERVICES).join(', ')}`,
                },
                { status: 400, headers: CORS_HEADERS }
            );
        }

        // Validate required fields
        if (!email) {
            return NextResponse.json(
                { success: false, error: 'email is required.' },
                { status: 400, headers: CORS_HEADERS }
            );
        }

        if (!fullName && !firstName) {
            return NextResponse.json(
                { success: false, error: 'fullName or firstName is required.' },
                { status: 400, headers: CORS_HEADERS }
            );
        }

        const phoneNumber = phone || mobile || undefined;

        // Build details — capture all extra fields the developer might send
        const details: Record<string, unknown> = {
            service,
            serviceLabel: serviceConfig.label,
        };
        if (company) details.company = company;
        if (projectRequirements) details.projectRequirements = projectRequirements;
        if (message) details.message = message;

        const result = await ingestExternalLead({
            fullName: fullName || `${firstName || ''} ${lastName || ''}`.trim(),
            firstName,
            lastName,
            email,
            phone: phoneNumber,
            sourceType: 'Website',
            sourceUrl: 'https://www.talentronaut.in',
            formId: `talentronaut-website-${service}`,
            formName: `${serviceConfig.label} Form`,
            appName: 'talentronaut-website',
            // Explicit taxonomy — bypasses routing rules
            projectName: 'Talentronaut',
            domainName: 'Talentronaut Website',
            subdomainName: serviceConfig.subdomainName,
            campaignName: 'Service Leads',
            sourceName: 'Website Service Form',
            company: company || undefined,
            details,
        });

        return NextResponse.json(
            {
                success: true,
                message: result.created
                    ? 'Lead captured successfully.'
                    : 'Existing lead updated successfully.',
                leadId: result.lead._id,
                created: result.created,
                service,
            },
            { status: result.created ? 201 : 200, headers: CORS_HEADERS }
        );
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Internal server error.';
        const status = message.includes('required') ? 400 : 500;
        console.error('Website Webhook Error:', error);

        return NextResponse.json(
            { success: false, error: message },
            { status, headers: CORS_HEADERS }
        );
    }
}

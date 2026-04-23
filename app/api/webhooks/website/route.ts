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

// Build a reverse lookup: display name → slug (case-insensitive)
const SERVICE_NAME_TO_SLUG: Record<string, string> = Object.entries(SERVICES).reduce(
    (acc, [slug, { label }]) => {
        acc[label.toLowerCase()] = slug;
        return acc;
    },
    {} as Record<string, string>
);

/**
 * Resolve service config from either:
 *   - slug  e.g. "technical-solutions"
 *   - name  e.g. "Technical Solutions"
 */
function resolveService(service?: string, serviceName?: string) {
    const bySlug = service ? SERVICES[service.trim().toLowerCase()] : undefined;
    if (bySlug) return { slug: service!.trim().toLowerCase(), config: bySlug };

    const nameKey = (serviceName || service || '').trim().toLowerCase();
    const slug = SERVICE_NAME_TO_SLUG[nameKey];
    if (slug) return { slug, config: SERVICES[slug] };

    return null;
}

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
            serviceName,   // display name e.g. "Technical Solutions"
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

        // Resolve service from slug OR display name
        const resolved = resolveService(service, serviceName);
        if (!resolved) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Invalid service. Accepted slugs: ${Object.keys(SERVICES).join(', ')}. Accepted names: ${Object.values(SERVICES).map((s) => s.label).join(', ')}.`,
                },
                { status: 400, headers: CORS_HEADERS }
            );
        }
        const { slug: serviceSlug, config: serviceConfig } = resolved;

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

        // Build details — store service info + all extra fields the developer sends
        const details: Record<string, unknown> = {
            service: serviceSlug,
            serviceName: serviceConfig.label,   // stored as "serviceName" for display
            serviceLabel: serviceConfig.label,  // kept for backwards compat
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
            formId: `talentronaut-website-${serviceSlug}`,
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
                service: serviceSlug,
                serviceName: serviceConfig.label,
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

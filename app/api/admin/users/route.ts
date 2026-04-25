import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';

const DEFAULT_SHARED_SECRET = 'talentronaut-tool-auth-dev';

function getWorkspaceAuthBaseUrl() {
    return process.env.WORKSPACE_AUTH_URL || 'http://localhost:3000';
}

function getSharedSecret() {
    return process.env.TOOL_AUTH_SHARED_SECRET || DEFAULT_SHARED_SECRET;
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const toolId = searchParams.get('toolId');

        if (toolId === 'crm') {
            const response = await fetch(
                `${getWorkspaceAuthBaseUrl().replace(/\/$/, '')}/api/tools/accessible-users?toolId=crm`,
                {
                    method: 'GET',
                    headers: {
                        'X-Tool-Auth-Secret': getSharedSecret(),
                    },
                    cache: 'no-store',
                }
            );

            const data = await response.json().catch(() => null);

            if (!response.ok || !data?.success) {
                return NextResponse.json(
                    { error: data?.error || 'Failed to fetch CRM-accessible users' },
                    { status: response.status || 502 }
                );
            }

            return NextResponse.json({ users: data.users || [] });
        }

        await dbConnect();
        const users = await User.find({
            status: { $ne: 'Inactive' },
        }, 'name email role').sort({ name: 1 });
        return NextResponse.json({ users });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch users';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

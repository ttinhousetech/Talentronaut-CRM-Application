import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const DEFAULT_SHARED_SECRET = 'talentronaut-tool-auth-dev';

function getWorkspaceAuthBaseUrl() {
    return process.env.WORKSPACE_AUTH_URL || 'http://localhost:3000';
}

function getSharedSecret() {
    return process.env.TOOL_AUTH_SHARED_SECRET || DEFAULT_SHARED_SECRET;
}

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                accessCode: { label: 'Access Code', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.accessCode) {
                    throw new Error('Please provide your access code');
                }

                const response = await fetch(`${getWorkspaceAuthBaseUrl().replace(/\/$/, '')}/api/tools/authorize`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Tool-Auth-Secret': getSharedSecret(),
                    },
                    body: JSON.stringify({
                        accessCode: credentials.accessCode,
                        toolId: 'crm',
                    }),
                    cache: 'no-store',
                });

                let data: unknown = null;
                try {
                    data = await response.json();
                } catch {
                    data = null;
                }

                const authData = data as {
                    success?: boolean;
                    allowed?: boolean;
                    user?: {
                        id: string;
                        name: string;
                        email: string;
                        role: string;
                        profilePicture?: string;
                    };
                    error?: string;
                } | null;

                if (!response.ok || !authData?.success || !authData?.allowed || !authData?.user) {
                    throw new Error(authData?.error || 'Unauthorized: You do not have access to the CRM. Please contact an admin.');
                }

                return {
                    id: authData.user.id,
                    name: authData.user.name,
                    email: authData.user.email,
                    role: authData.user.role,
                    workspaceUserId: authData.user.id,
                    image: authData.user.profilePicture || undefined,
                };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.role = user.role;
                token.id = user.id;
                token.workspaceUserId = user.workspaceUserId || user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (session?.user) {
                session.user.role = token.role as string;
                (session.user as any).id = token.id as string;
                session.user.workspaceUserId = token.workspaceUserId as string;
            }
            return session;
        },
    },
    pages: {
        signIn: '/login',
    },
    session: {
        strategy: 'jwt',
    },
    secret: process.env.NEXTAUTH_SECRET,
};

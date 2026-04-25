import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Lead from '@/models/Lead';
import '@/models/Source'; // register for Lead.populate('source')
import '@/models/User';   // register for Lead.populate('assignedTo')


export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await dbConnect();

        const userId = (session.user as any).id;
        const role = (session.user as any).role;

        let query: any = { assignedTo: userId };

        if (role === 'Lead') {
            query = {
                $or: [
                    { assignedTo: userId },
                    { 'meetings.hostId': userId }
                ]
            };
        } else if (role === 'Admin') {
            query = {}; // Typically Admins see all leads
        }

        const leads = await Lead.find(query)
            .populate('source', 'name')
            .populate('assignedTo', 'name email')
            .sort({ updatedAt: -1 });

        return NextResponse.json({ leads });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

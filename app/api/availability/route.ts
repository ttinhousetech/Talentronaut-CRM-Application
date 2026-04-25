import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Availability from '@/models/Availability';

export async function GET(req: Request) {
    try {
        await dbConnect();
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // If a member is querying a leader's availability
        const url = new URL(req.url);
        const leaderId = url.searchParams.get('leaderId');

        const queryId = leaderId || (session.user as any).id;

        const availability = await Availability.find({ leaderId: queryId }).sort({ dayOfWeek: 1 });

        return NextResponse.json({ success: true, availability });
    } catch (error) {
        console.error('Fetch Availability Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch availability' },
            { status: 500 }
        );
    }
}

export async function POST(req: Request) {
    try {
        await dbConnect();
        const session = await getServerSession(authOptions);

        if (!session?.user || (session.user.role !== 'Admin' && session.user.role !== 'Lead')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const data = await req.json();
        const { availabilityData } = data; // Array of availability objects { dayOfWeek, startTime, endTime, isAvailable }

        if (!Array.isArray(availabilityData)) {
            return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
        }

        // Bulk upsert availability
        const operations = availabilityData.map((item: any) => ({
            updateOne: {
                filter: { leaderId: (session.user as any).id, dayOfWeek: item.dayOfWeek },
                update: {
                    $set: {
                        startTime: item.startTime,
                        endTime: item.endTime,
                        isAvailable: item.isAvailable,
                    }
                },
                upsert: true,
            }
        }));

        if (operations.length > 0) {
            await Availability.bulkWrite(operations);
        }

        return NextResponse.json({ success: true, message: 'Availability updated successfully' });
    } catch (error) {
        console.error('Update Availability Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update availability' },
            { status: 500 }
        );
    }
}

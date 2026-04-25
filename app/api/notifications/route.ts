import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Notification from '@/models/Notification';
import mongoose from 'mongoose';

// GET: Fetch unread (or all) notifications for the logged-in user
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !(session.user as any)?.id) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(req.url);
        const unreadOnly = url.searchParams.get('unread') === 'true';

        await dbConnect();

        const query: any = { userId: new mongoose.Types.ObjectId((session.user as any).id) };
        if (unreadOnly) {
            query.read = false;
        }

        const notifications = await Notification.find(query).sort({ createdAt: -1 }).limit(50);

        return NextResponse.json({ success: true, count: notifications.length, data: notifications });
    } catch (error: any) {
        console.error('Error fetching notifications:', error);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}

// PATCH: Mark one or all notifications as read
export async function PATCH(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !(session.user as any)?.id) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { notificationId } = body;

        await dbConnect();

        if (notificationId) {
            // Mark specific notification as read
            const updated = await Notification.findOneAndUpdate(
                { _id: notificationId, userId: new mongoose.Types.ObjectId((session.user as any).id) },
                { read: true },
                { new: true }
            );
            return NextResponse.json({ success: true, data: updated });
        } else {
            // Mark all as read
            await Notification.updateMany(
                { userId: new mongoose.Types.ObjectId((session.user as any).id), read: false },
                { read: true }
            );
            return NextResponse.json({ success: true, message: 'All notifications marked as read' });
        }
    } catch (error: any) {
        console.error('Error updating notifications:', error);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}

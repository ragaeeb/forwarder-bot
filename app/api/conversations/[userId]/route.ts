import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '../../../../lib/db/index.js';

/**
 * GET /api/conversations/:userId
 * Returns the thread and all messages for a specific user.
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ userId: string }> },
): Promise<NextResponse> {
    try {
        const { userId } = await params;
        const db = await getDb();

        const [thread, messages] = await Promise.all([db.getThreadByUserId(userId), db.getMessagesByUserId(userId)]);

        if (!thread) {
            return NextResponse.json({ error: 'Thread not found', ok: false }, { status: 404 });
        }

        return NextResponse.json({ messages, thread });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal server error', ok: false }, { status: 500 });
    }
}

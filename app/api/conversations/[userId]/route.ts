import { type NextRequest, NextResponse } from 'next/server';

import type { SavedMessage, ThreadData } from '@/types/app';
import { getDataService } from '../../../../lib/db/index';

export async function GET(_request: NextRequest, context: { params: Promise<{ userId: string }> }) {
    try {
        const { userId } = await context.params;

        const db = getDataService();
        const thread = await db.getThreadByUserId(userId);

        if (!thread) {
            return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
        }

        const messages = await db.getMessagesByUserId(userId);

        return NextResponse.json({ thread, messages } as { thread: ThreadData; messages: SavedMessage[] });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

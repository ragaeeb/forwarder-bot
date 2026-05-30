import { type NextRequest, NextResponse } from 'next/server';
import type { TelegramMessage } from '@/types/telegram';
import { mapTelegramMessageToSavedMessage } from '@/utils/messageUtils';
import { getDataService } from '../../../../../lib/db/index';
import { sendReply } from '../../../../../lib/telegram/sendReply';

export async function POST(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
    try {
        const { userId } = await context.params;

        let body: { text?: string };
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
        }

        if (!body?.text || typeof body.text !== 'string') {
            return NextResponse.json({ ok: false, error: 'Missing or invalid text' }, { status: 400 });
        }

        const db = getDataService();
        const thread = await db.getThreadByUserId(userId);

        if (!thread) {
            return NextResponse.json({ ok: false, error: 'Thread not found' }, { status: 404 });
        }

        const sentMessage = await sendReply(userId, body.text);

        const savedMessage = mapTelegramMessageToSavedMessage(sentMessage as TelegramMessage, 'admin');
        await db.saveMessage(savedMessage);

        await db.saveThread({
            ...thread,
            lastMessageId: sentMessage.message_id.toString(),
            updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({ ok: true, messageId: sentMessage.message_id.toString() });
    } catch (error) {
        return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 200 });
    }
}

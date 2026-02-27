import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '../../../../../lib/db/index.js';
import { sendReplyToUser } from '../../../../../lib/telegram/sendReply.js';
import { mapTelegramMessageToSavedMessage } from '../../../../../src/utils/messageUtils.js';
import { config } from '../../../../../src/config.js';

/**
 * POST /api/conversations/:userId/reply
 * Sends a reply to a user from the web UI.
 *
 * Body: { text: string }
 * Response: { ok: boolean, messageId?: string, error?: string }
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> },
): Promise<NextResponse> {
    try {
        const { userId } = await params;
        const body = await request.json();
        const { text } = body;

        if (!text || typeof text !== 'string' || !text.trim()) {
            return NextResponse.json({ error: 'text is required', ok: false }, { status: 400 });
        }

        const db = await getDb();
        const thread = await db.getThreadByUserId(userId);

        if (!thread) {
            return NextResponse.json({ error: 'Thread not found', ok: false }, { status: 404 });
        }

        // Send via Telegram
        const messageId = await sendReplyToUser(userId, text.trim());

        // Save to DB as admin message
        const now = new Date().toISOString();
        const savedMessage = await db.saveMessage({
            chatId: userId,
            from: {
                userId: 'admin',
            },
            id: messageId,
            text: text.trim(),
            timestamp: now,
            type: 'admin',
        });

        // Update thread's last message
        await db.saveThread({
            ...thread,
            lastMessageAt: now,
            lastMessageId: messageId,
            updatedAt: now,
        });

        return NextResponse.json({ messageId: savedMessage.id, ok: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal server error', ok: false }, { status: 500 });
    }
}

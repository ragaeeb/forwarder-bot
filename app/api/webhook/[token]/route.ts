import { NextRequest, NextResponse } from 'next/server';

import { config } from '../../../../src/config.js';
import { getBot } from '../../../../lib/bot/instance.js';

/**
 * POST /api/webhook/:token
 *
 * Replaces the AWS Lambda handler. Validates the secret token header,
 * then passes the update to the bot singleton.
 *
 * Always returns HTTP 200 to Telegram (even on error) to prevent
 * Telegram from retrying.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
    const { token } = await params;

    // Validate the webhook token in the URL matches the bot token
    if (token !== config.BOT_TOKEN) {
        return NextResponse.json({ error: 'Unauthorized', ok: false }, { status: 403 });
    }

    // Validate the secret token header
    const secretHeader = request.headers.get('x-telegram-bot-api-secret-token');
    if (config.SECRET_TOKEN && secretHeader !== config.SECRET_TOKEN) {
        return NextResponse.json({ error: 'Unauthorized', ok: false }, { status: 403 });
    }

    try {
        const body = await request.text();

        if (body) {
            const update = JSON.parse(body);
            const bot = await getBot();
            await bot.handleUpdate(update);
        }

        return NextResponse.json({ ok: true }, { status: 200 });
    } catch (error: any) {
        // Always return 200 to Telegram even on errors
        return NextResponse.json({ error: error.message || String(error), ok: false }, { status: 200 });
    }
}

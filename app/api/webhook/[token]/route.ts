import { type NextRequest, NextResponse } from 'next/server';

import { config } from '@/config';
import type { TelegramUpdate } from '@/types/telegram';
import logger from '@/utils/logger';
import { getBot } from '../../../../lib/bot/instance';

export async function POST(request: NextRequest, _context: { params: Promise<{ token: string }> }) {
    const secretToken = request.headers.get('x-telegram-bot-api-secret-token');

    if (secretToken !== config.SECRET_TOKEN) {
        logger.warn('Invalid secret token in webhook request');
        return NextResponse.json({ error: 'Unauthorized', ok: false }, { status: 403 });
    }

    try {
        let body: unknown = null;
        const text = await request.text();
        if (text) {
            try {
                body = JSON.parse(text);
            } catch {
                logger.warn('Invalid JSON body in webhook request');
            }
        }

        if (body && typeof body === 'object') {
            await getBot().handleUpdate(body as TelegramUpdate);
        }
    } catch (error) {
        logger.error(error, 'Error processing webhook');
        return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 200 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
}

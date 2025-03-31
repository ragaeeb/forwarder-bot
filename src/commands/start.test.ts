import { ForwardContext } from '@/types/app.js';
import { mapTelegramMessageToSavedMessage } from '@/utils/messageUtils.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { onStart } from './start.js';

vi.mock('@/utils/messageUtils.js', () => ({
    mapTelegramMessageToSavedMessage: vi.fn().mockReturnValue({ id: '1' }),
}));

describe('start', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('onStart', () => {
        it('should reply to the message', async () => {
            const ctx = { db: { saveMessage: vi.fn() }, message: { id: 'm1' }, reply: vi.fn(), settings: {} };

            await onStart(ctx as unknown as ForwardContext);

            expect(ctx.reply).toHaveBeenCalledOnce();
            expect(ctx.reply).toHaveBeenCalledWith(
                "👋 You can use this bot to communicate with our team. Simply send a message and it will be forwarded to us.\n\nWe'll reply to you through this same chat.",
            );

            expect(ctx.db.saveMessage).toHaveBeenCalledExactlyOnceWith({ id: '1' });
            expect(mapTelegramMessageToSavedMessage).toHaveBeenCalledExactlyOnceWith({ id: 'm1' }, 'user');
        });

        it('should reply to the custom greeting', async () => {
            const ctx = { db: { saveMessage: vi.fn() }, reply: vi.fn(), settings: { greeting: 'G' } };

            await onStart(ctx as unknown as ForwardContext);

            expect(ctx.reply).toHaveBeenCalledOnce();
            expect(ctx.reply).toHaveBeenCalledWith('G');
        });
    });
});

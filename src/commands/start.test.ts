import { describe, expect, it, mock } from 'bun:test';
import type { ForwardContext } from '@/types/app.js';
import { mapTelegramMessageToSavedMessage } from '@/utils/messageUtils.js';

import { onStart } from './start.js';

mock.module('@/utils/messageUtils.js', () => ({
    mapTelegramMessageToSavedMessage: mock(() => ({ id: '1' })),
}));

describe('start', () => {
    describe('onStart', () => {
        it('should reply to the message', async () => {
            const ctx = {
                db: { saveMessage: mock(() => {}) },
                message: { id: 'm1' },
                reply: mock(() => {}),
                settings: {},
            };

            await onStart(ctx as unknown as ForwardContext);

            expect(ctx.reply).toHaveBeenCalledTimes(1);
            expect(ctx.reply).toHaveBeenCalledWith(
                "👋 You can use this bot to communicate with our team. Simply send a message and it will be forwarded to us.\n\nWe'll reply to you through this same chat.",
            );

            expect(ctx.db.saveMessage).toHaveBeenCalledTimes(1);
            expect(ctx.db.saveMessage).toHaveBeenCalledWith({ id: '1' });
            expect(mapTelegramMessageToSavedMessage).toHaveBeenCalledTimes(1);
            expect(mapTelegramMessageToSavedMessage).toHaveBeenCalledWith({ id: 'm1' }, 'user');
        });

        it('should reply to the custom greeting', async () => {
            const ctx = { db: { saveMessage: mock(() => {}) }, reply: mock(() => {}), settings: { greeting: 'G' } };

            await onStart(ctx as unknown as ForwardContext);

            expect(ctx.reply).toHaveBeenCalledTimes(1);
            expect(ctx.reply).toHaveBeenCalledWith('G');
        });
    });
});

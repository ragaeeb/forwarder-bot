import { ForwardContext } from '@/types/app.js';
import { mapTelegramMessageToSavedMessage } from '@/utils/messageUtils.js';
import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { onStart } from './start.js';

mock.module('@/utils/messageUtils.js', () => ({
    mapTelegramMessageToSavedMessage: mock(() => {}).mockReturnValue({ id: '1' })}));

describe('start', () => {
    beforeEach(() => {
        mock.restore();
    });

    describe('onStart', () => {
        it('should reply to the message', async () => {
            const ctx = { db: { saveMessage: mock(() => {}) }, message: { id: 'm1' }, reply: mock(() => {}), settings: {} };

            await onStart(ctx as unknown as ForwardContext);

            expect(ctx.reply).toHaveBeenCalledOnce();
            expect(ctx.reply).toHaveBeenCalledWith(
                "👋 You can use this bot to communicate with our team. Simply send a message and it will be forwarded to us.\n\nWe'll reply to you through this same chat.",
            );

            expect(ctx.db.saveMessage).toHaveBeenCalledExactlyOnceWith({ id: '1' });
            expect(mapTelegramMessageToSavedMessage).toHaveBeenCalledExactlyOnceWith({ id: 'm1' }, 'user');
        });

        it('should reply to the custom greeting', async () => {
            const ctx = { db: { saveMessage: mock(() => {}) }, reply: mock(() => {}), settings: { greeting: 'G' } };

            await onStart(ctx as unknown as ForwardContext);

            expect(ctx.reply).toHaveBeenCalledOnce();
            expect(ctx.reply).toHaveBeenCalledWith('G');
        });
    });
});

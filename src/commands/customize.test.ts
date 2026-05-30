import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { ForwardContext } from '@/types/app.js';
import { replyWithError, replyWithSuccess } from '@/utils/replyUtils.js';

import { onCustomize } from './customize.js';

mock.module('@/utils/replyUtils.js', () => ({
    replyWithError: mock(() => {}),
    replyWithSuccess: mock(() => {}),
}));

describe('customize', () => {
    beforeEach(() => {
        mock.clearAllMocks();
    });

    describe('onCustomize', () => {
        it('should reject the invalid command', async () => {
            const ctx = { args: 'Test', text: '/abcd Test' };

            await onCustomize(ctx as unknown as ForwardContext);

            expect(replyWithError).toHaveBeenCalledTimes(1);
            expect(replyWithError).toHaveBeenCalledWith(ctx, expect.any(String));
        });

        it('should reject missing text', async () => {
            const ctx = {};
            await onCustomize(ctx as unknown as ForwardContext);

            expect(replyWithError).toHaveBeenCalledTimes(1);
            expect(replyWithError).toHaveBeenCalledWith(ctx, 'Command undefined not found.');
        });

        it('should handle errors', async () => {
            const ctx = {
                args: 'Test',
                db: { saveSettings: mock(() => Promise.reject(new Error('Error saving'))) },
                text: '/ack Test',
            };

            await onCustomize(ctx as unknown as ForwardContext);

            expect(ctx.db.saveSettings).toHaveBeenCalledTimes(1);
            expect(ctx.db.saveSettings).toHaveBeenCalledWith({ ack: 'Test' });
            expect(replyWithError).toHaveBeenCalledTimes(1);
            expect(replyWithError).toHaveBeenCalledWith(ctx, expect.any(String));
        });

        it.each([
            'ack',
            'greeting',
            'failure',
        ])('should save the config with the customization message', async (command) => {
            const ctx = {
                args: 'Acknowledged it!',
                db: { saveSettings: mock(() => Promise.resolve({ ack: 'Acknowledged it!' })) },
                settings: {},
                text: `/${command} Acknowledged it!`,
            };

            await onCustomize(ctx as unknown as ForwardContext);

            expect(replyWithError).not.toHaveBeenCalled();
            expect(ctx.db.saveSettings).toHaveBeenCalledTimes(1);
            expect(ctx.db.saveSettings).toHaveBeenCalledWith({ [command]: 'Acknowledged it!' });
            expect(replyWithSuccess).toHaveBeenCalledTimes(1);
            expect(replyWithSuccess).toHaveBeenCalledWith(ctx, expect.any(String));
        });
    });
});

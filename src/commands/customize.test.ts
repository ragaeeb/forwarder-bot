import type { ForwardContext } from '@/types/app.js';

import { replyWithError, replyWithSuccess } from '@/utils/replyUtils.js';
import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { onCustomize } from './customize.js';

mock.module('@/utils/replyUtils.js');

describe('customize', () => {
    beforeEach(() => {
        mock.restore();
    });

    describe('onCustomize', () => {
        it('should reject the invalid command', async () => {
            const ctx = { args: 'Test', text: '/abcd Test' };

            await onCustomize(ctx as unknown as ForwardContext);

            expect(replyWithError).toHaveBeenCalledExactlyOnceWith(ctx, expect.any(String));
        });

        it('should reject missing text', async () => {
            const ctx = {};
            await onCustomize(ctx as unknown as ForwardContext);

            expect(replyWithError).toHaveBeenCalledExactlyOnceWith(ctx, 'Command undefined not found.');
        });

        it('should handle errors', async () => {
            const ctx = {
                args: 'Test',
                db: { saveSettings: mock(() => {}).mockRejectedValueOnce(new Error('Error saving')) },
                text: '/ack Test'};

            await onCustomize(ctx as unknown as ForwardContext);

            expect(ctx.db.saveSettings).toHaveBeenCalledExactlyOnceWith({ ack: 'Test' });
            expect(replyWithError).toHaveBeenCalledExactlyOnceWith(ctx, expect.any(String));
        });

        it.each(['ack', 'greeting', 'failure'])(
            'should save the config with the customization message',
            async (command) => {
                const ctx = {
                    args: 'Acknowledged it!',
                    db: { saveSettings: mock(() => {}).mockResolvedValue({ ack: 'Acknowledged it!' }) },
                    settings: {},
                    text: `/${command} Acknowledged it!`};

                await onCustomize(ctx as unknown as ForwardContext);

                expect(replyWithError).not.toHaveBeenCalled();
                expect(ctx.db.saveSettings).toHaveBeenCalledExactlyOnceWith({ [command]: 'Acknowledged it!' });
                expect(replyWithSuccess).toHaveBeenCalledExactlyOnceWith(ctx, expect.any(String));
            },
        );
    });
});

import type { ForwardContext } from '@/types.js';

import { replyWithError, replyWithSuccess } from '@/utils/replyUtils.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { onCustomize } from './customize.js';

vi.mock('@/utils/replyUtils.js');

describe('customize', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
                db: { saveSettings: vi.fn().mockRejectedValueOnce(new Error('Error saving')) },
                text: '/ack Test',
            };

            await onCustomize(ctx as unknown as ForwardContext);

            expect(ctx.db.saveSettings).toHaveBeenCalledExactlyOnceWith({ ack: 'Test' });
            expect(replyWithError).toHaveBeenCalledExactlyOnceWith(ctx, expect.any(String));
        });

        it.each(['ack', 'greeting', 'failure'])(
            'should save the config with the customization message',
            async (command) => {
                const ctx = {
                    args: 'Acknowledged it!',
                    db: { saveSettings: vi.fn().mockResolvedValue({ ack: 'Acknowledged it!' }) },
                    settings: {},
                    text: `/${command} Acknowledged it!`,
                };

                await onCustomize(ctx as unknown as ForwardContext);

                expect(replyWithError).not.toHaveBeenCalled();
                expect(ctx.db.saveSettings).toHaveBeenCalledExactlyOnceWith({ [command]: 'Acknowledged it!' });
                expect(replyWithSuccess).toHaveBeenCalledExactlyOnceWith(ctx, expect.any(String));
            },
        );
    });
});

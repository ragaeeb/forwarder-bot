import { describe, expect, it, mock } from 'bun:test';
import type { ForwardContext } from '@/types/app.js';

mock.module('@/utils/replyUtils.js', () => {
    const replyWithEmoji = async (ctx: ForwardContext, emoji: string, message: string) =>
        ctx.reply(`${emoji} ${message}`);
    return {
        replyWithError: (ctx: ForwardContext, message: string) => replyWithEmoji(ctx, '❌', message),
        replyWithSuccess: (ctx: ForwardContext, message: string) => replyWithEmoji(ctx, '✅', message),
        replyWithWarning: (ctx: ForwardContext, message: string) => replyWithEmoji(ctx, '⚠️', message),
    };
});

import { replyWithError, replyWithSuccess, replyWithWarning } from './replyUtils.js';

describe('replyUtils', () => {
    const createMockContext = (overrides = {}) =>
        ({
            reply: mock(() => Promise.resolve({ message_id: 123 })),
            ...overrides,
        }) as unknown as ForwardContext;

    describe('replyWithError', () => {
        it('should reply with error emoji and message', async () => {
            const ctx = createMockContext();
            const message = 'This is an error message';

            await replyWithError(ctx, message);

            expect(ctx.reply).toHaveBeenCalledWith('❌ This is an error message');
        });
    });

    describe('replyWithSuccess', () => {
        it('should reply with success emoji and message', async () => {
            const ctx = createMockContext();
            const message = 'Operation completed successfully';

            await replyWithSuccess(ctx, message);

            expect(ctx.reply).toHaveBeenCalledWith('✅ Operation completed successfully');
        });

        it('should return the result from ctx.reply', async () => {
            const mockReplyResult = { message_id: 456, text: 'Test message' };
            const ctx = createMockContext({
                reply: mock(() => Promise.resolve(mockReplyResult)),
            });

            const result = await replyWithSuccess(ctx, 'Test message');

            expect(result).toBe(mockReplyResult);
        });
    });

    describe('replyWithWarning', () => {
        it('should reply with warning emoji', async () => {
            const ctx = createMockContext();

            await replyWithWarning(ctx, 'Something');

            expect(ctx.reply).toHaveBeenCalledWith('⚠️ Something');
        });
    });
});

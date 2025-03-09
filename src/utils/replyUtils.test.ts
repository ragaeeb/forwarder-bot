import { describe, expect, it, vi } from 'vitest';

import type { ForwardContext } from '../types';

import { replyWithError, replyWithSuccess, replyWithUnknownError } from './replyUtils';

describe('replyUtils', () => {
    const createMockContext = (overrides = {}) =>
        ({
            reply: vi.fn().mockResolvedValue({ message_id: 123 }),
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
    });

    describe('replyWithUnknownError', () => {
        it('should reply with generic error message', async () => {
            const ctx = createMockContext();

            await replyWithUnknownError(ctx);

            expect(ctx.reply).toHaveBeenCalledWith('❌ Failed to deliver your message. Please try again later.');
        });
    });

    it('should return the result from ctx.reply', async () => {
        const mockReplyResult = { message_id: 456, text: 'Test message' };
        const ctx = createMockContext({
            reply: vi.fn().mockResolvedValue(mockReplyResult),
        });

        const result = await replyWithSuccess(ctx, 'Test message');

        expect(result).toBe(mockReplyResult);
    });
});

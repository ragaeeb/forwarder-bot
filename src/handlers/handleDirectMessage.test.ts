import { ForwardContext } from '@/types.js';
import logger from '@/utils/logger.js';
import { mapTelegramMessageToSavedMessage } from '@/utils/messageUtils.js';
import { replyWithSuccess } from '@/utils/replyUtils.js';
import { createNewThread, getUpsertedThread } from '@/utils/threadUtils.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleDirectMessage } from './handleDirectMessage.js';

vi.mock('@/utils/logger.js', () => ({
    default: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
}));

vi.mock('@/utils/messageUtils.js', () => ({
    mapTelegramMessageToSavedMessage: vi.fn().mockReturnValue({ id: '123', type: 'user' }),
}));

vi.mock('@/utils/replyUtils.js', () => ({
    replyWithSuccess: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/utils/threadUtils.js', () => ({
    createNewThread: vi.fn(),
    getUpsertedThread: vi.fn(),
}));

describe('handleDirectMessage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should forward message to admin group successfully', async () => {
        const threadData = { chatId: '789', threadId: 456, userId: '123' };
        const ctx = {
            api: { forwardMessage: vi.fn().mockResolvedValue({}) },
            chatId: 123,
            db: { saveMessage: vi.fn().mockResolvedValue({}) },
            from: { id: 123 },
            id: 789,
            update: { message: { message_id: 789, text: 'Hello admin' } },
        } as unknown as ForwardContext;

        (getUpsertedThread as any).mockResolvedValue(threadData);

        const result = await handleDirectMessage(ctx, 'admin-group-123');

        expect(getUpsertedThread).toHaveBeenCalledWith(ctx, 'admin-group-123');
        expect(ctx.db.saveMessage).toHaveBeenCalledTimes(1);
        expect(mapTelegramMessageToSavedMessage).toHaveBeenCalledWith(ctx.update?.message, 'user');

        expect(ctx.api.forwardMessage).toHaveBeenCalledWith({
            chat_id: 'admin-group-123',
            from_chat_id: 123,
            message_id: 789,
            message_thread_id: 456,
        });

        expect(replyWithSuccess).toHaveBeenCalledWith(
            ctx,
            `Message delivered, our team will get back to you in shāʾ Allah.`,
        );

        expect(result).toBeDefined();
    });

    it('should return undefined when thread data is not found', async () => {
        const ctx = { from: { id: 123 } } as unknown as ForwardContext;

        (getUpsertedThread as any).mockResolvedValue(null);

        const result = await handleDirectMessage(ctx, 'admin-group-123');

        expect(getUpsertedThread).toHaveBeenCalledWith(ctx, 'admin-group-123');
        expect(result).toBeUndefined();
    });

    it('should save message before forwarding', async () => {
        const threadData = { chatId: '789', threadId: 456, userId: '123' };
        const ctx = {
            api: { forwardMessage: vi.fn().mockResolvedValue({}) },
            chatId: 123,
            db: { saveMessage: vi.fn().mockResolvedValue({}) },
            from: { id: 123 },
            id: 789,
            update: { message: { message_id: 789, text: 'Hello admin' } },
        } as unknown as ForwardContext;

        (getUpsertedThread as any).mockResolvedValue(threadData);

        await handleDirectMessage(ctx, 'admin-group-123');

        expect(ctx.db.saveMessage).toHaveBeenCalledTimes(1);
        expect(ctx.db.saveMessage).toHaveBeenCalledWith(expect.objectContaining({ id: '123', type: 'user' }));

        const saveMessageOrder = vi.mocked(ctx.db.saveMessage).mock.invocationCallOrder[0];
        const forwardMessageOrder = vi.mocked(ctx.api.forwardMessage).mock.invocationCallOrder[0];

        expect(saveMessageOrder).toBeLessThan(forwardMessageOrder);
    });

    it('should log errors when forward message fails', async () => {
        const ctx = {
            api: {
                forwardMessage: vi.fn().mockRejectedValue({}),
            },
            chatId: 123,
            db: { saveMessage: vi.fn().mockResolvedValue({}) },
            from: { id: 123 },
            id: 789,
            update: { message: { message_id: 789 } },
        } as unknown as ForwardContext;

        (getUpsertedThread as any).mockResolvedValue({ chatId: '789', threadId: 456, userId: '123' });

        try {
            await handleDirectMessage(ctx, 'admin-group-123');
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_) {
            // Intentionally ignoring the error since it's expected and tested separately
        }

        expect(logger.error).toHaveBeenCalled();
    });

    it('should get or create thread before forwarding', async () => {
        const threadData = { chatId: '789', threadId: 456, userId: '123' };
        const ctx = {
            api: { forwardMessage: vi.fn().mockResolvedValue({}) },
            chatId: 123,
            db: { saveMessage: vi.fn().mockResolvedValue({}) },
            from: { id: 123 },
            id: 789,
            update: { message: { message_id: 789 } },
        } as unknown as ForwardContext;

        (getUpsertedThread as any).mockResolvedValue(threadData);

        await handleDirectMessage(ctx, 'admin-group-123');

        expect(getUpsertedThread).toHaveBeenCalledWith(ctx, 'admin-group-123');

        const getThreadOrder = vi.mocked(getUpsertedThread).mock.invocationCallOrder[0];
        const forwardMessageOrder = vi.mocked(ctx.api.forwardMessage).mock.invocationCallOrder[0];

        expect(getThreadOrder).toBeLessThan(forwardMessageOrder);
    });

    it('should retry forward when thread not found error occurs', async () => {
        const threadData = { chatId: '789', threadId: 456, userId: '123' };
        const newThreadData = { chatId: '789', threadId: 789, userId: '123' };

        const ctx = {
            api: {
                forwardMessage: vi
                    .fn()
                    .mockRejectedValueOnce({ message: 'message thread not found' })
                    .mockResolvedValueOnce({}),
            },
            chatId: 123,
            db: { saveMessage: vi.fn().mockResolvedValue({}) },
            from: { id: 123 },
            id: 789,
            update: { message: { message_id: 789 } },
        } as unknown as ForwardContext;

        (getUpsertedThread as any).mockResolvedValue(threadData);
        (createNewThread as any).mockResolvedValue(newThreadData);
        (replyWithSuccess as any).mockResolvedValue('success-result');

        const result = await handleDirectMessage(ctx, 'admin-group-123');

        expect(createNewThread).toHaveBeenCalledWith(ctx, 'admin-group-123');
        expect(ctx.api.forwardMessage).toHaveBeenCalledTimes(2);

        // Second call should have the new thread ID
        expect(ctx.api.forwardMessage).toHaveBeenLastCalledWith({
            chat_id: 'admin-group-123',
            from_chat_id: 123,
            message_id: 789,
            message_thread_id: 789,
        });

        expect(result).toBeDefined();
    });

    it('should handle errors during thread recreation', async () => {
        const threadData = { chatId: '789', threadId: 456, userId: '123' };

        const ctx = {
            api: {
                forwardMessage: vi.fn().mockRejectedValue({
                    message: 'message thread not found',
                }),
            },
            chatId: 123,
            db: { saveMessage: vi.fn().mockResolvedValue({}) },
            from: { id: 123 },
            id: 789,
            update: { message: { message_id: 789 } },
        } as unknown as ForwardContext;

        (getUpsertedThread as any).mockResolvedValue(threadData);
        (createNewThread as any).mockRejectedValue(new Error('Failed to create thread'));

        const result = await handleDirectMessage(ctx, 'admin-group-123');

        expect(createNewThread).toHaveBeenCalledWith(ctx, 'admin-group-123');
        expect(logger.error).toHaveBeenCalledTimes(2); // Both the original error and retry error
        expect(logger.error).toHaveBeenLastCalledWith(
            'Failed to forward message after retry',
            expect.objectContaining({
                userId: 123,
            }),
        );

        expect(result).toBeUndefined();
    });

    it('should handle when forwardMessageToGroup returns undefined', async () => {
        const threadData = { chatId: '789', threadId: 456, userId: '123' };

        const ctx = {
            api: {
                forwardMessage: vi.fn().mockResolvedValue({}),
            },
            chatId: 123,
            db: { saveMessage: vi.fn().mockResolvedValue({}) },
            from: { id: 123 },
            id: 789,
            update: { message: { message_id: 789 } },
        } as unknown as ForwardContext;

        (getUpsertedThread as any).mockResolvedValue(threadData);
        (replyWithSuccess as any).mockResolvedValue(undefined); // This will make forwardMessageToGroup return undefined

        const result = await handleDirectMessage(ctx, 'admin-group-123');

        expect(replyWithSuccess).toHaveBeenCalled();
        expect(result).toBeUndefined();
    });
});

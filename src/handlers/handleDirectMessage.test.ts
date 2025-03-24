import type { ForwardContext } from '@/types/app.js';

import { mapTelegramMessageToSavedMessage } from '@/utils/messageUtils.js';
import { replyWithError, replyWithSuccess } from '@/utils/replyUtils.js';
import { createNewThread } from '@/utils/threadUtils.js';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { onDirectMessage } from './handleDirectMessage.js';

vi.mock('@/utils/replyUtils.js');
vi.mock('@/utils/threadUtils.js');
vi.mock('@/utils/messageUtils.js');

describe('onDirectMessage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should forward message to admin group successfully', async () => {
        const ctx = {
            bot: { api: { forwardMessage: vi.fn().mockResolvedValue({}) } },
            chat: { id: 123 },
            db: { saveMessage: vi.fn().mockResolvedValue({}) },
            from: { id: 123 },
            message: { message_id: 789, text: 'Hello admin' },
            settings: { adminGroupId: '1' },
            thread: { chatId: '789', threadId: 456, userId: '123' },
        } as unknown as ForwardContext;

        (mapTelegramMessageToSavedMessage as Mock).mockReturnValue({ id: '123', type: 'user' });

        await onDirectMessage(ctx);

        expect(ctx.db.saveMessage).toHaveBeenCalledExactlyOnceWith({ id: '123', type: 'user' });

        expect(ctx.bot.api.forwardMessage).toHaveBeenCalledExactlyOnceWith({
            chat_id: '1',
            from_chat_id: 123,
            message_id: 789,
            message_thread_id: 456,
        });

        expect(replyWithSuccess).toHaveBeenCalledOnce();
    });

    it('should retry forward when thread not found error occurs', async () => {
        const ctx = {
            bot: {
                api: {
                    forwardMessage: vi
                        .fn()
                        .mockRejectedValueOnce({ message: 'message thread not found' })
                        .mockResolvedValueOnce({}),
                },
            },
            chat: { id: 123 },
            db: { saveMessage: vi.fn().mockResolvedValue({}) },
            from: { id: 123 },
            message: { message_id: 1 },
            settings: { adminGroupId: 'admin-group-123' },
            thread: { chatId: '789', threadId: 2, userId: '123' },
        } as unknown as ForwardContext;

        (createNewThread as any).mockResolvedValue({ chatId: '789', threadId: 9, userId: '123' });
        (replyWithSuccess as any).mockResolvedValue('success-result');

        await onDirectMessage(ctx);

        expect(createNewThread).toHaveBeenCalledWith(ctx);
        expect(ctx.bot.api.forwardMessage).toHaveBeenCalledTimes(2);

        expect(ctx.bot.api.forwardMessage).toHaveBeenNthCalledWith(1, {
            chat_id: 'admin-group-123',
            from_chat_id: 123,
            message_id: 1,
            message_thread_id: 2,
        });

        expect(ctx.bot.api.forwardMessage).toHaveBeenLastCalledWith({
            chat_id: 'admin-group-123',
            from_chat_id: 123,
            message_id: 1,
            message_thread_id: 9,
        });
    });

    it('should handle errors during thread recreation', async () => {
        const ctx = {
            bot: {
                api: {
                    forwardMessage: vi.fn().mockRejectedValue({
                        message: 'message thread not found',
                    }),
                },
            },
            chat: { id: 123 },
            db: { saveMessage: vi.fn().mockResolvedValue({}) },
            from: { id: 123 },
            id: 789,
            message: { message_id: 789 },
            settings: { adminGroupId: 'admin-group-123', failure: 'F' },
            thread: { chatId: '789', threadId: 456, userId: '123' },
        } as unknown as ForwardContext;

        (createNewThread as any).mockRejectedValue(new Error('Failed to create thread'));

        await onDirectMessage(ctx);

        expect(createNewThread).toHaveBeenCalledExactlyOnceWith(ctx);
        expect(replyWithError).toHaveBeenCalledExactlyOnceWith(ctx, 'F');
    });

    it('should handle non-thread related errors', async () => {
        const ctx = {
            bot: {
                api: {
                    forwardMessage: vi.fn().mockRejectedValue({
                        message: 'something',
                    }),
                },
            },
            chat: { id: 123 },
            db: { saveMessage: vi.fn().mockResolvedValue({}) },
            from: { id: 123 },
            id: 789,
            message: { message_id: 789 },
            settings: { adminGroupId: 'admin-group-123', failure: 'F' },
            thread: { chatId: '789', threadId: 456, userId: '123' },
        } as unknown as ForwardContext;

        await onDirectMessage(ctx);

        expect(createNewThread).not.toHaveBeenCalled();
        expect(replyWithError).toHaveBeenCalledOnce();
        expect(replyWithSuccess).not.toHaveBeenCalled();
    });

    it('should handle errors if message cannot be forwarded the 2nd time', async () => {
        const ctx = {
            bot: {
                api: {
                    forwardMessage: vi
                        .fn()
                        .mockRejectedValueOnce({
                            message: 'message thread not found',
                        })
                        .mockRejectedValueOnce({
                            message: 'message thread not found again',
                        }),
                },
            },
            chat: { id: 123 },
            db: { saveMessage: vi.fn().mockResolvedValue({}) },
            from: { id: 123 },
            id: 789,
            message: { message_id: 789 },
            settings: { adminGroupId: 'admin-group-123' },
            thread: { chatId: '789', threadId: 456, userId: '123' },
        } as unknown as ForwardContext;

        (createNewThread as any).mockResolvedValue({ chatId: '789', threadId: 9, userId: '123' });

        await onDirectMessage(ctx);

        expect(createNewThread).toHaveBeenCalledExactlyOnceWith(ctx);
        expect(replyWithError).toHaveBeenCalledExactlyOnceWith(
            ctx,
            'Could not deliver message, please try again later.',
        );
    });

    it('should handle database errors', async () => {
        const ctx = {
            db: { saveMessage: vi.fn().mockRejectedValue(new Error('Cannot access database')) },
            settings: {},
        } as unknown as ForwardContext;

        await onDirectMessage(ctx);

        expect(replyWithError).toHaveBeenCalledOnce();
    });
});

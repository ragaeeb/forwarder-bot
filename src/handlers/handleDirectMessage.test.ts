import { beforeEach, describe, expect, it, type Mock, mock } from 'bun:test';
import type { ForwardContext } from '@/types/app.js';
import { mapTelegramMessageToSavedMessage } from '@/utils/messageUtils.js';
import { replyWithError, replyWithSuccess } from '@/utils/replyUtils.js';
import { createNewThread } from '@/utils/threadUtils.js';

import { onDirectMessage } from './handleDirectMessage.js';

mock.module('@/utils/replyUtils.js', () => ({
    replyWithError: mock(() => {}),
    replyWithSuccess: mock(() => {}),
    replyWithWarning: mock(() => {}),
}));
mock.module('@/utils/threadUtils.js', () => ({
    createNewThread: mock(() => {}),
    updateThreadByMessage: mock(() => {}),
}));
mock.module('@/utils/messageUtils.js', () => ({
    mapTelegramMessageToSavedMessage: mock(() => ({ id: '123', type: 'user' })),
}));

describe('onDirectMessage', () => {
    beforeEach(() => {
        (mapTelegramMessageToSavedMessage as Mock).mockClear();
        (createNewThread as Mock).mockClear();
        (replyWithError as Mock).mockClear();
        (replyWithSuccess as Mock).mockClear();
    });

    it('should forward message to admin group successfully', async () => {
        const ctx = {
            bot: { api: { forwardMessage: mock(() => Promise.resolve({})) } },
            chat: { id: 123 },
            db: { saveMessage: mock(() => Promise.resolve({})) },
            from: { id: 123 },
            message: { message_id: 789, text: 'Hello admin' },
            settings: { adminGroupId: '1' },
            thread: { chatId: '789', threadId: 456, userId: '123' },
        } as unknown as ForwardContext;

        (mapTelegramMessageToSavedMessage as Mock).mockReturnValue({ id: '123', type: 'user' });

        await onDirectMessage(ctx);

        expect(ctx.db.saveMessage).toHaveBeenCalledTimes(1);
        expect(ctx.db.saveMessage).toHaveBeenCalledWith({ id: '123', type: 'user' });

        expect(ctx.bot.api.forwardMessage).toHaveBeenCalledTimes(1);
        expect(ctx.bot.api.forwardMessage).toHaveBeenCalledWith({
            chat_id: '1',
            from_chat_id: 123,
            message_id: 789,
            message_thread_id: 456,
        });

        expect(replyWithSuccess).toHaveBeenCalledTimes(1);
    });

    it('should retry forward when thread not found error occurs', async () => {
        const forwardMessageMock = mock(() => {})
            .mockRejectedValueOnce({ message: 'message thread not found' })
            .mockResolvedValueOnce({});

        const ctx = {
            bot: {
                api: {
                    forwardMessage: forwardMessageMock,
                },
            },
            chat: { id: 123 },
            db: { saveMessage: mock(() => Promise.resolve({})) },
            from: { id: 123 },
            message: { message_id: 1 },
            settings: { adminGroupId: 'admin-group-123' },
            thread: { chatId: '789', threadId: 2, userId: '123' },
        } as unknown as ForwardContext;

        (createNewThread as Mock).mockResolvedValue({ chatId: '789', threadId: 9, userId: '123' });
        (replyWithSuccess as Mock).mockResolvedValue('success-result');

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
                    forwardMessage: mock(() =>
                        Promise.reject({
                            message: 'message thread not found',
                        }),
                    ),
                },
            },
            chat: { id: 123 },
            db: { saveMessage: mock(() => Promise.resolve({})) },
            from: { id: 123 },
            id: 789,
            message: { message_id: 789 },
            settings: { adminGroupId: 'admin-group-123', failure: 'F' },
            thread: { chatId: '789', threadId: 456, userId: '123' },
        } as unknown as ForwardContext;

        (createNewThread as Mock).mockRejectedValue(new Error('Failed to create thread'));

        await onDirectMessage(ctx);

        expect(createNewThread).toHaveBeenCalledTimes(1);
        expect(createNewThread).toHaveBeenCalledWith(ctx);
        expect(replyWithError).toHaveBeenCalledTimes(1);
        expect(replyWithError).toHaveBeenCalledWith(ctx, 'F');
    });

    it('should handle non-thread related errors', async () => {
        const ctx = {
            bot: {
                api: {
                    forwardMessage: mock(() =>
                        Promise.reject({
                            message: 'something',
                        }),
                    ),
                },
            },
            chat: { id: 123 },
            db: { saveMessage: mock(() => Promise.resolve({})) },
            from: { id: 123 },
            id: 789,
            message: { message_id: 789 },
            settings: { adminGroupId: 'admin-group-123', failure: 'F' },
            thread: { chatId: '789', threadId: 456, userId: '123' },
        } as unknown as ForwardContext;

        await onDirectMessage(ctx);

        expect(createNewThread).not.toHaveBeenCalled();
        expect(replyWithError).toHaveBeenCalledTimes(1);
        expect(replyWithSuccess).not.toHaveBeenCalled();
    });

    it('should handle errors if message cannot be forwarded the 2nd time', async () => {
        const ctx = {
            bot: {
                api: {
                    forwardMessage: mock(() => {})
                        .mockRejectedValueOnce({
                            message: 'message thread not found',
                        })
                        .mockRejectedValueOnce({
                            message: 'message thread not found again',
                        }),
                },
            },
            chat: { id: 123 },
            db: { saveMessage: mock(() => Promise.resolve({})) },
            from: { id: 123 },
            id: 789,
            message: { message_id: 789 },
            settings: { adminGroupId: 'admin-group-123' },
            thread: { chatId: '789', threadId: 456, userId: '123' },
        } as unknown as ForwardContext;

        (createNewThread as Mock).mockResolvedValue({ chatId: '789', threadId: 9, userId: '123' });

        await onDirectMessage(ctx);

        expect(createNewThread).toHaveBeenCalledTimes(1);
        expect(createNewThread).toHaveBeenCalledWith(ctx);
        expect(replyWithError).toHaveBeenCalledTimes(1);
        expect(replyWithError).toHaveBeenCalledWith(ctx, 'Could not deliver message, please try again later.');
    });

    it('should handle database errors', async () => {
        const ctx = {
            db: { saveMessage: mock(() => Promise.reject(new Error('Cannot access database'))) },
            settings: {},
        } as unknown as ForwardContext;

        await onDirectMessage(ctx);

        expect(replyWithError).toHaveBeenCalledTimes(1);
    });
});

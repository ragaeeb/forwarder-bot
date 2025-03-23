import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ForwardContext, ThreadData } from '../types.js';

import { createNewThread, getUpsertedThread, updateThreadByMessage } from './threadUtils.js';

describe('getUpsertedThread', () => {
    it('should update existing thread when found', async () => {
        const ctx = {
            bot: {
                api: {
                    createForumTopic: vi.fn(),
                },
            },
            chat: { id: 54321, type: 'private' },
            db: {
                getThreadByUserId: vi.fn().mockResolvedValue({
                    chatId: '54321',
                    createdAt: '2022-02-20T00:00:00.000Z',
                    lastMessageId: '67880',
                    name: '12345: John Doe (johndoe)',
                    threadId: 99999,
                    updatedAt: '2022-02-22T00:00:00.000Z',
                    userId: '12345',
                }),
                saveThread: vi.fn().mockResolvedValue({
                    chatId: '54321',
                    createdAt: '2022-02-20T00:00:00.000Z',
                    lastMessageId: '67890',
                    name: '12345: John Doe (johndoe)',
                    threadId: 99999,
                    updatedAt: '2022-02-23T12:00:00.000Z',
                    userId: '12345',
                }),
            },
            from: {
                firstName: 'John',
                id: 12345,
                lastName: 'Doe',
                username: 'johndoe',
            },
            update: {
                message: {
                    chat: { id: 54321, type: 'private' },
                    date: 1645564800,
                    message_id: 67890,
                },
            },
        } as unknown as ForwardContext;

        const result = await getUpsertedThread(ctx, 'admin-group-123');
        const expected = {
            chatId: '54321',
            createdAt: '2022-02-20T00:00:00.000Z',
            lastMessageId: '67890',
            name: '12345: John Doe (johndoe)',
            threadId: 99999,
            updatedAt: '2022-02-23T12:00:00.000Z',
            userId: '12345',
        };

        expect(ctx.db.getThreadByUserId).toHaveBeenCalledWith('12345');
        expect(ctx.db.saveThread).toHaveBeenCalledWith(expected);

        expect(ctx.bot.api.createForumTopic).not.toHaveBeenCalled();
        expect(result).toEqual(expected);
    });

    it('should create new thread when not found', async () => {
        const ctx = {
            bot: {
                api: {
                    createForumTopic: vi.fn().mockResolvedValue({
                        message_thread_id: 99999,
                        name: '12345: John Doe (johndoe)',
                    }),
                },
            },
            chat: { id: 54321, type: 'private' },
            db: {
                getThreadByUserId: vi.fn().mockResolvedValue(null),
                saveThread: vi.fn().mockResolvedValue({
                    chatId: '54321',
                    createdAt: '2022-02-23T00:00:00.000Z',
                    lastMessageId: '67890',
                    name: '12345: John Doe (johndoe)',
                    threadId: 99999,
                    updatedAt: '2022-02-23T12:00:00.000Z',
                    userId: '12345',
                }),
            },
            from: {
                firstName: 'John',
                id: 12345,
                lastName: 'Doe',
                username: 'johndoe',
            },
            update: {
                message: {
                    chat: { id: 54321, type: 'private' },
                    date: 1645564800,
                    message_id: 67890,
                },
            },
        } as unknown as ForwardContext;

        const result = await getUpsertedThread(ctx, 'admin-group-123');

        expect(ctx.db.getThreadByUserId).toHaveBeenCalledWith('12345');
        expect(ctx.bot.api.createForumTopic).toHaveBeenCalledWith({
            chat_id: 'admin-group-123',
            name: '12345: John Doe (johndoe)',
        });

        expect(result).toEqual({
            chatId: '54321',
            createdAt: '2022-02-23T00:00:00.000Z',
            lastMessageId: '67890',
            name: '12345: John Doe (johndoe)',
            threadId: 99999,
            updatedAt: '2022-02-23T12:00:00.000Z',
            userId: '12345',
        });
    });

    it('should handle errors during creation of new thread', async () => {
        const error = new Error('Failed to create forum topic');

        const ctx = {
            bot: {
                api: {
                    createForumTopic: vi.fn().mockRejectedValue(error),
                },
            },
            chat: { id: 54321, type: 'private' },
            db: {
                getThreadByUserId: vi.fn().mockResolvedValue(null),
            },
            from: {
                firstName: 'John',
                id: 12345,
                lastName: 'Doe',
                username: 'johndoe',
            },
            update: {
                message: {
                    chat: { id: 54321, type: 'private' },
                    date: 1645564800,
                    message_id: 67890,
                },
            },
        } as unknown as ForwardContext;

        const result = await getUpsertedThread(ctx, 'admin-group-123');

        expect(ctx.db.getThreadByUserId).toHaveBeenCalledWith('12345');
        expect(ctx.bot.api.createForumTopic).toHaveBeenCalled();
        expect(result).toBeUndefined();
    });
});

import type { TelegramMessage } from '@/types/telegram.js';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ForwardContext, ThreadData } from '../types/app.js';

import { createNewThread, updateThreadByMessage } from './threadUtils.js';

describe('threadUtils', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2022-02-23T12:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('createNewThread', () => {
        it('should create a new thread successfully', async () => {
            const ctx = {
                bot: {
                    api: {
                        createForumTopic: vi.fn().mockResolvedValue({
                            message_thread_id: 99999,
                            name: '12345: John Doe (johndoe)',
                        }),
                    },
                },
                chat: { id: 54321 },
                db: {
                    saveThread: vi.fn().mockResolvedValue({
                        chatId: '54321',
                        createdAt: '2022-02-23T00:00:00.000Z',
                        lastMessageId: '67890',
                        name: '12345: John Doe (johndoe)',
                        threadId: '99999',
                        updatedAt: '2022-02-23T12:00:00.000Z',
                        userId: '12345',
                    }),
                },
                from: {
                    first_name: 'John',
                    id: 12345,
                    last_name: 'Doe',
                    username: 'johndoe',
                },
                message: {
                    chat: { id: 54321, type: 'private' },
                    date: 1645564800,
                    message_id: 67890,
                },
                settings: {
                    adminGroupId: 'admin-group-123',
                },
            } as unknown as ForwardContext;

            const groupId = 'admin-group-123';

            const result = await createNewThread(ctx);

            expect(ctx.bot.api.createForumTopic).toHaveBeenCalledExactlyOnceWith({
                chat_id: groupId,
                name: '12345: John Doe (johndoe)',
            });

            expect(ctx.db.saveThread).toHaveBeenCalledExactlyOnceWith({
                chatId: '54321',
                createdAt: expect.any(String),
                lastMessageId: '67890',
                name: '12345: John Doe (johndoe)',
                threadId: '99999',
                updatedAt: '2022-02-23T12:00:00.000Z',
                userId: '12345',
            });

            expect(result).toEqual({
                chatId: '54321',
                createdAt: '2022-02-23T00:00:00.000Z',
                lastMessageId: '67890',
                name: '12345: John Doe (johndoe)',
                threadId: '99999',
                updatedAt: '2022-02-23T12:00:00.000Z',
                userId: '12345',
            });
        });

        it('should map user information correctly when some fields are missing', async () => {
            const ctx = {
                bot: {
                    api: {
                        createForumTopic: vi.fn().mockResolvedValue({
                            message_thread_id: 99999,
                            name: '12345: John',
                        }),
                    },
                },
                chat: { id: 54321, type: 'private' },
                db: {
                    saveThread: vi.fn().mockResolvedValue({
                        chatId: '54321',
                        createdAt: '2022-02-23T00:00:00.000Z',
                        lastMessageId: '67890',
                        name: '12345: John',
                        threadId: '99999',
                        updatedAt: '2022-02-23T12:00:00.000Z',
                        userId: '12345',
                    }),
                },
                from: {
                    first_name: 'John',
                    id: 12345,
                },
                message: {
                    chat: { id: 54321, type: 'private' },
                    date: 1645564800,
                    message_id: 67890,
                },
                settings: { adminGroupId: 'admin-group-123' },
            } as unknown as ForwardContext;

            const result = await createNewThread(ctx);

            expect(ctx.bot.api.createForumTopic).toHaveBeenCalledExactlyOnceWith({
                chat_id: 'admin-group-123',
                name: '12345: John',
            });

            expect(result?.name).toBe('12345: John');
        });

        it('should throw error if topic could not be created', async () => {
            const ctx = {
                bot: {
                    api: {
                        createForumTopic: vi.fn().mockRejectedValue(new Error('Could not create topic')),
                    },
                },
                chat: { id: 54321, type: 'private' },
                from: {
                    id: 12345,
                },
                settings: { adminGroupId: 'admin-group-123' },
            } as unknown as ForwardContext;

            await expect(createNewThread(ctx)).rejects.toThrow(expect.any(Error));

            expect(ctx.bot.api.createForumTopic).toHaveBeenCalledExactlyOnceWith({
                chat_id: 'admin-group-123',
                name: '12345',
            });
        });

        it('should throw error if thread could not be saved', async () => {
            const ctx = {
                bot: {
                    api: {
                        createForumTopic: vi.fn().mockResolvedValue({
                            message_thread_id: 99999,
                            name: '12345: John Doe (johndoe)',
                        }),
                    },
                },
                chat: { id: 54321 },
                db: {
                    saveThread: vi.fn().mockRejectedValue(new Error('Could not save thread')),
                },
                from: {
                    id: 12345,
                },
                settings: { adminGroupId: 'admin-group-123' },
            } as unknown as ForwardContext;

            await expect(createNewThread(ctx)).rejects.toThrow(expect.any(Error));
        });
    });

    describe('updateThreadByMessage', () => {
        it('should update thread with new message information', async () => {
            const ctx = {
                db: {
                    saveThread: vi.fn().mockResolvedValue({
                        chatId: '54321',
                        createdAt: '2022-02-20T00:00:00.000Z',
                        lastMessageId: '99999',
                        name: '12345: John Doe (johndoe)',
                        threadId: '99999',
                        updatedAt: '2022-02-23T12:00:00.000Z',
                        userId: '12345',
                    }),
                },
            } as unknown as ForwardContext;

            const threadData = {
                chatId: '54321',
                createdAt: '2022-02-20T00:00:00.000Z',
                lastMessageId: '67880',
                name: '12345: John Doe (johndoe)',
                threadId: '99999',
                updatedAt: '2022-02-22T00:00:00.000Z',
                userId: '12345',
            } as ThreadData;

            const message = {
                chat: { id: 54321, type: 'private' },
                date: 1645564800,
                message_id: 99999,
            } as TelegramMessage;

            const result = await updateThreadByMessage(ctx, threadData, message);

            const expected = {
                chatId: '54321',
                createdAt: '2022-02-20T00:00:00.000Z',
                lastMessageId: '99999',
                name: '12345: John Doe (johndoe)',
                threadId: '99999',
                updatedAt: '2022-02-23T12:00:00.000Z',
                userId: '12345',
            };

            expect(ctx.db.saveThread).toHaveBeenCalledExactlyOnceWith(expected);
            expect(result).toEqual(expected);
        });
    });
});

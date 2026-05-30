import { beforeEach, describe, expect, it } from 'bun:test';

import type { BotSettings, SavedMessage, ThreadData } from '@/types/app.js';

import { SQLiteDataService } from './sqlite.js';

describe('SQLiteDataService', () => {
    let db: SQLiteDataService;

    beforeEach(() => {
        db = new SQLiteDataService(':memory:');
    });

    describe('getSettings', () => {
        it('should return undefined when no config has been set', async () => {
            const config = await db.getSettings();
            expect(config).toBeUndefined();
        });

        it('should return the saved config when it exists', async () => {
            const botConfig: BotSettings = {
                adminGroupId: '12345',
                setupAt: '2023-01-01T00:00:00Z',
                setupBy: {
                    first_name: 'Test',
                    id: 67890,
                    is_bot: false,
                },
            };

            await db.saveSettings(botConfig);
            const config = await db.getSettings();

            expect(config).toEqual(botConfig);
        });

        it('should round-trip settings with all optional JSON fields', async () => {
            const botConfig: BotSettings = {
                adminGroupId: '-100123',
                ack: 'Acknowledged',
                failure: 'Something went wrong',
                greeting: 'Hello!',
                setupAt: '2024-06-15T12:00:00Z',
                setupBy: {
                    first_name: 'Admin',
                    id: 111,
                    is_bot: false,
                    last_name: 'User',
                    username: 'adminuser',
                },
            };

            await db.saveSettings(botConfig);
            const retrieved = await db.getSettings();

            expect(retrieved).toEqual(botConfig);
        });
    });

    describe('saveSettings', () => {
        it('should save and return the provided config', async () => {
            const botConfig: BotSettings = {
                adminGroupId: '12345',
                setupAt: '2023-01-01T00:00:00Z',
                setupBy: {
                    first_name: 'Test',
                    id: 67890,
                    is_bot: false,
                },
            };

            const savedConfig = await db.saveSettings(botConfig);

            expect(savedConfig).toEqual(botConfig);
        });

        it('should overwrite previous config when saving a new one', async () => {
            const initialConfig: BotSettings = {
                adminGroupId: '12345',
                setupAt: '2023-01-01T00:00:00Z',
                setupBy: {
                    first_name: 'Test',
                    id: 67890,
                    is_bot: false,
                },
            };

            const updatedConfig: BotSettings = {
                adminGroupId: '98765',
                setupAt: '2023-01-02T00:00:00Z',
                setupBy: {
                    first_name: 'Updated Test',
                    id: 54321,
                    is_bot: false,
                },
            };

            await db.saveSettings(initialConfig);
            await db.saveSettings(updatedConfig);

            const config = await db.getSettings();
            expect(config).toEqual(updatedConfig);
        });
    });

    describe('getMessagesByUserId', () => {
        it('should return an empty array when no messages exist for the user', async () => {
            const thread = {
                userId: '123',
                threadId: 't1',
                name: 'User 123',
                lastMessageId: 'm1',
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-01-01T00:00:00Z',
            };
            await db.saveThread(thread);

            const messages = await db.getMessagesByUserId('123');
            expect(messages).toEqual([]);
        });

        it('should return only messages for the specified user', async () => {
            const thread1 = {
                userId: '123',
                threadId: 't1',
                name: 'User 1',
                lastMessageId: 'm1',
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-01-01T00:00:00Z',
            };
            const thread2 = {
                userId: '456',
                threadId: 't2',
                name: 'User 2',
                lastMessageId: 'm2',
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-01-01T00:00:00Z',
            };
            await db.saveThread(thread1);
            await db.saveThread(thread2);

            const user1Message: SavedMessage = {
                chatId: '100',
                from: {
                    firstName: 'User1',
                    userId: '123',
                },
                id: '1',
                text: 'Hello from user 1',
                timestamp: '2023-01-01T00:00:00Z',
                type: 'user',
            };

            const user2Message: SavedMessage = {
                chatId: '200',
                from: {
                    firstName: 'User2',
                    userId: '456',
                },
                id: '2',
                text: 'Hello from user 2',
                timestamp: '2023-01-01T00:00:00Z',
                type: 'user',
            };

            await db.saveMessage(user1Message);
            await db.saveMessage(user2Message);

            const user1Messages = await db.getMessagesByUserId('123');
            expect(user1Messages).toEqual([user1Message]);

            const user2Messages = await db.getMessagesByUserId('456');
            expect(user2Messages).toEqual([user2Message]);
        });

        it('should return multiple messages for the same user ordered by timestamp desc', async () => {
            const thread: ThreadData = {
                userId: '123',
                threadId: 't1',
                name: 'User1',
                lastMessageId: '2',
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-01-01T00:01:00Z',
            };
            await db.saveThread(thread);

            const message1: SavedMessage = {
                chatId: '100',
                from: { firstName: 'User1', userId: '123' },
                id: '1',
                text: 'First message',
                timestamp: '2023-01-01T00:00:00Z',
                type: 'user',
            };

            const message2: SavedMessage = {
                chatId: '100',
                from: { firstName: 'User1', userId: '123' },
                id: '2',
                text: 'Second message',
                timestamp: '2023-01-01T00:01:00Z',
                type: 'user',
            };

            await db.saveMessage(message1);
            await db.saveMessage(message2);

            const messages = await db.getMessagesByUserId('123');
            expect(messages).toEqual([message2, message1]);
        });
    });

    describe('saveMessage', () => {
        it('should save and return the message', async () => {
            const thread: ThreadData = {
                userId: '123',
                threadId: 't1',
                name: 'User',
                lastMessageId: '1',
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-01-01T00:00:00Z',
            };
            await db.saveThread(thread);

            const message: SavedMessage = {
                chatId: '100',
                from: { firstName: 'User1', userId: '123' },
                id: '1',
                text: 'Test message',
                timestamp: '2023-01-01T00:00:00Z',
                type: 'user',
            };

            const savedMessage = await db.saveMessage(message);

            expect(savedMessage).toEqual(message);
            const retrieved = await db.getMessagesByUserId('123');
            expect(retrieved).toContainEqual(message);
        });

        it('should preserve all optional fields when saving', async () => {
            const thread: ThreadData = {
                userId: '123',
                threadId: 't1',
                name: 'User',
                lastMessageId: '1',
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-01-01T00:00:00Z',
            };
            await db.saveThread(thread);

            const message: SavedMessage = {
                caption: 'Caption text',
                chatId: '100',
                from: {
                    firstName: 'User1',
                    lastName: 'Test',
                    userId: '123',
                    username: 'user1test',
                },
                id: '1',
                mediaId: 'media-123',
                mediaType: 'photo',
                originalMessageId: 'original-1',
                quote: 'Quoted text',
                replyToMessageId: 'reply-123',
                text: 'Test message',
                timestamp: '2023-01-01T00:00:00Z',
                type: 'user',
                forwardOrigin: {
                    type: 'user',
                    date: 1234567890,
                    sender_user: {
                        first_name: 'Forwarder',
                        id: 999,
                    },
                },
            };

            const savedMessage = await db.saveMessage(message);

            expect(savedMessage).toEqual(message);
            const retrieved = await db.getMessagesByUserId('123');
            expect(retrieved[0]).toEqual(message);
        });

        it('should throw when saving message with invalid type (schema CHECK constraint)', async () => {
            const thread: ThreadData = {
                userId: '123',
                threadId: 't1',
                name: 'User',
                lastMessageId: '1',
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-01-01T00:00:00Z',
            };
            await db.saveThread(thread);

            const invalidMessage = {
                chatId: '100',
                from: { userId: '123' },
                id: '1',
                text: 'Test',
                timestamp: '2023-01-01T00:00:00Z',
                type: 'invalid',
            } as unknown as SavedMessage;

            await expect(db.saveMessage(invalidMessage)).rejects.toThrow();
        });

        it('should replace existing message when saving same id (INSERT OR REPLACE)', async () => {
            const thread: ThreadData = {
                userId: '123',
                threadId: 't1',
                name: 'User',
                lastMessageId: '1',
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-01-01T00:00:00Z',
            };
            await db.saveThread(thread);

            const message: SavedMessage = {
                chatId: '100',
                from: { userId: '123' },
                id: '1',
                text: 'Original',
                timestamp: '2023-01-01T00:00:00Z',
                type: 'user',
            };

            await db.saveMessage(message);
            const updated = { ...message, text: 'Updated' };
            await db.saveMessage(updated);

            const retrieved = await db.getMessagesByUserId('123');
            expect(retrieved).toHaveLength(1);
            expect(retrieved[0].text).toBe('Updated');
        });
    });

    describe('getThreadById', () => {
        it('should return undefined when no thread with the specified ID exists', async () => {
            const thread = await db.getThreadById('unknown-thread');
            expect(thread).toBeUndefined();
        });

        it('should return the thread with the specified ID when it exists', async () => {
            const threadData: ThreadData = {
                createdAt: '2023-01-01T00:00:00Z',
                lastMessageId: 'msg-001',
                name: 'Test Thread',
                threadId: 'thread-123',
                updatedAt: '2023-01-01T00:00:00Z',
                userId: 'user-456',
            };

            await db.saveThread(threadData);

            const foundThread = await db.getThreadById('thread-123');
            expect(foundThread).toEqual(threadData);
        });
    });

    describe('getThreadByUserId', () => {
        it('should return undefined when no thread for the specified user exists', async () => {
            const thread = await db.getThreadByUserId('unknown-user');
            expect(thread).toBeUndefined();
        });

        it('should return the thread for the specified user when it exists', async () => {
            const threadData: ThreadData = {
                createdAt: '2023-01-01T00:00:00Z',
                lastMessageId: 'msg-001',
                name: 'Test Thread',
                threadId: 'thread-123',
                updatedAt: '2023-01-01T00:00:00Z',
                userId: 'user-456',
            };

            await db.saveThread(threadData);

            const foundThread = await db.getThreadByUserId('user-456');
            expect(foundThread).toEqual(threadData);
        });

        it('should return the most recent thread when user has multiple threads', async () => {
            const older: ThreadData = {
                createdAt: '2023-01-01T00:00:00Z',
                lastMessageId: 'm1',
                name: 'Older',
                threadId: 't1',
                updatedAt: '2023-01-01T00:00:00Z',
                userId: 'user-1',
            };
            const newer: ThreadData = {
                createdAt: '2023-01-02T00:00:00Z',
                lastMessageId: 'm2',
                name: 'Newer',
                threadId: 't2',
                updatedAt: '2023-01-02T00:00:00Z',
                userId: 'user-1',
            };

            await db.saveThread(older);
            await db.saveThread(newer);

            const found = await db.getThreadByUserId('user-1');
            expect(found).toEqual(newer);
        });
    });

    describe('saveThread', () => {
        it('should add the thread and return it', async () => {
            const threadData: ThreadData = {
                createdAt: '2023-01-01T00:00:00Z',
                lastMessageId: 'msg-001',
                name: 'Test Thread',
                threadId: 'thread-123',
                updatedAt: '2023-01-01T00:00:00Z',
                userId: 'user-456',
            };

            const savedThread = await db.saveThread(threadData);

            expect(savedThread).toEqual(threadData);
            const found = await db.getThreadById('thread-123');
            expect(found).toEqual(threadData);
        });

        it('should update existing thread when saving same user_id and thread_id (INSERT OR REPLACE)', async () => {
            const thread: ThreadData = {
                createdAt: '2023-01-01T00:00:00Z',
                lastMessageId: 'm1',
                name: 'Original',
                threadId: 't1',
                updatedAt: '2023-01-01T00:00:00Z',
                userId: 'user-1',
            };

            await db.saveThread(thread);

            const updated: ThreadData = {
                ...thread,
                lastMessageId: 'm2',
                name: 'Updated',
                updatedAt: '2023-01-02T00:00:00Z',
            };

            await db.saveThread(updated);

            const found = await db.getThreadById('t1');
            expect(found).toEqual(updated);
        });

        it('should allow saving multiple threads', async () => {
            const thread1: ThreadData = {
                createdAt: '2023-01-01T00:00:00Z',
                lastMessageId: 'msg-001',
                name: 'First Thread',
                threadId: 'thread-123',
                updatedAt: '2023-01-01T00:00:00Z',
                userId: 'user-456',
            };

            const thread2: ThreadData = {
                createdAt: '2023-01-02T00:00:00Z',
                lastMessageId: 'msg-002',
                name: 'Second Thread',
                threadId: 'thread-456',
                updatedAt: '2023-01-02T00:00:00Z',
                userId: 'user-789',
            };

            await db.saveThread(thread1);
            await db.saveThread(thread2);

            expect(await db.getThreadCount()).toBe(2);
            expect(await db.getThreadById('thread-123')).toEqual(thread1);
            expect(await db.getThreadById('thread-456')).toEqual(thread2);
        });
    });

    describe('getAllThreads', () => {
        it('should return empty array when no threads exist', async () => {
            const threads = await db.getAllThreads();
            expect(threads).toEqual([]);
        });

        it('should return all threads ordered by updated_at desc', async () => {
            const t1: ThreadData = {
                createdAt: '2023-01-01T00:00:00Z',
                lastMessageId: 'm1',
                name: 'First',
                threadId: 't1',
                updatedAt: '2023-01-01T00:00:00Z',
                userId: 'u1',
            };
            const t2: ThreadData = {
                createdAt: '2023-01-02T00:00:00Z',
                lastMessageId: 'm2',
                name: 'Second',
                threadId: 't2',
                updatedAt: '2023-01-02T00:00:00Z',
                userId: 'u2',
            };

            await db.saveThread(t1);
            await db.saveThread(t2);

            const threads = await db.getAllThreads();
            expect(threads).toEqual([t2, t1]);
        });

        it('should support pagination with limit and offset', async () => {
            for (let i = 0; i < 5; i++) {
                await db.saveThread({
                    createdAt: '2023-01-01T00:00:00Z',
                    lastMessageId: `m${i}`,
                    name: `Thread ${i}`,
                    threadId: `t${i}`,
                    updatedAt: `2023-01-0${i + 1}T00:00:00Z`,
                    userId: `u${i}`,
                });
            }

            const page1 = await db.getAllThreads({ limit: 2, offset: 0 });
            expect(page1).toHaveLength(2);

            const page2 = await db.getAllThreads({ limit: 2, offset: 2 });
            expect(page2).toHaveLength(2);

            const page3 = await db.getAllThreads({ limit: 2, offset: 4 });
            expect(page3).toHaveLength(1);

            expect(page1[0].threadId).not.toBe(page2[0].threadId);
        });
    });

    describe('getThreadCount', () => {
        it('should return 0 when no threads exist', async () => {
            const count = await db.getThreadCount();
            expect(count).toBe(0);
        });

        it('should return the correct count', async () => {
            await db.saveThread({
                userId: 'u1',
                threadId: 't1',
                name: 'T1',
                lastMessageId: 'm1',
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-01-01T00:00:00Z',
            });
            await db.saveThread({
                userId: 'u2',
                threadId: 't2',
                name: 'T2',
                lastMessageId: 'm2',
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-01-01T00:00:00Z',
            });

            const count = await db.getThreadCount();
            expect(count).toBe(2);
        });
    });

    describe('getUnreadCount', () => {
        it('should return 0 when no threads exist for user', async () => {
            const count = await db.getUnreadCount('nonexistent');
            expect(count).toBe(0);
        });

        it('should return the sum of unread_count for user threads', async () => {
            await db.saveThread({
                userId: 'u1',
                threadId: 't1',
                name: 'T1',
                lastMessageId: 'm1',
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-01-01T00:00:00Z',
            });
            await db.saveThread({
                userId: 'u1',
                threadId: 't2',
                name: 'T2',
                lastMessageId: 'm2',
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-01-01T00:00:00Z',
            });

            const count = await db.getUnreadCount('u1');
            expect(count).toBe(0);
        });
    });

    describe('markThreadRead', () => {
        it('should set unread_count to 0 for all threads of user', async () => {
            await db.saveThread({
                userId: 'u1',
                threadId: 't1',
                name: 'T1',
                lastMessageId: 'm1',
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-01-01T00:00:00Z',
            });

            await db.markThreadRead('u1');

            const count = await db.getUnreadCount('u1');
            expect(count).toBe(0);
        });
    });
});

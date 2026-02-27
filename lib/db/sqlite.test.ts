import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import type { BotSettings, SavedMessage, ThreadData } from '../../src/types/app.js';

import { SQLiteService } from './sqlite.js';

describe('SQLiteService', () => {
    let db: SQLiteService;

    const sampleSettings: BotSettings = {
        ack: 'Message received',
        adminGroupId: '-100123456789',
        failure: 'Could not deliver',
        greeting: 'Hello!',
        setupAt: '2023-01-01T00:00:00.000Z',
        setupBy: { first_name: 'Admin', id: 654321, is_bot: false },
    };

    const sampleThread: ThreadData = {
        createdAt: '2023-01-01T00:00:00.000Z',
        lastMessageId: 'msg_001',
        name: '123456: Test User (testuser)',
        threadId: '11111',
        unreadCount: 2,
        updatedAt: '2023-01-01T01:00:00.000Z',
        userId: '123456',
    };

    const sampleMessage: SavedMessage = {
        caption: 'Test caption',
        chatId: '123456',
        from: {
            firstName: 'Test',
            lastName: 'User',
            userId: '123456',
            username: 'testuser',
        },
        id: 'msg_001',
        mediaId: 'file_123',
        mediaType: 'photo',
        text: 'Hello world',
        timestamp: '2023-01-01T00:00:00.000Z',
        type: 'user',
    };

    beforeEach(() => {
        db = new SQLiteService(':memory:');
        // Seed a thread so foreign key constraints are satisfied
        db['db']
            .prepare(
                `INSERT OR IGNORE INTO threads (user_id, thread_id, name, last_message_id, unread_count, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            )
            .run('123456', '11111', 'Test', 'msg_001', 0, '2023-01-01T00:00:00.000Z', '2023-01-01T00:00:00.000Z');
    });

    afterEach(() => {
        db.close();
    });

    describe('constructor', () => {
        it('should create a database instance', () => {
            expect(db).toBeInstanceOf(SQLiteService);
        });

        it('should create an in-memory database without errors', () => {
            const memDb = new SQLiteService(':memory:');
            expect(memDb).toBeDefined();
            memDb.close();
        });
    });

    describe('getSettings / saveSettings', () => {
        it('should return undefined when no settings saved', async () => {
            const result = await db.getSettings();
            expect(result).toBeUndefined();
        });

        it('should save and retrieve settings', async () => {
            await db.saveSettings(sampleSettings);
            const result = await db.getSettings();
            expect(result).toEqual(sampleSettings);
        });

        it('should overwrite existing settings on second save', async () => {
            await db.saveSettings(sampleSettings);
            const updated: BotSettings = {
                ...sampleSettings,
                adminGroupId: '-100999999999',
                greeting: 'Updated greeting',
            };
            await db.saveSettings(updated);
            const result = await db.getSettings();
            expect(result?.adminGroupId).toBe('-100999999999');
            expect(result?.greeting).toBe('Updated greeting');
        });

        it('should handle settings with no optional fields', async () => {
            const minimal: BotSettings = {
                adminGroupId: '-100000000001',
                setupAt: '2023-06-01T00:00:00.000Z',
                setupBy: { first_name: 'Min', id: 1, is_bot: false },
            };
            await db.saveSettings(minimal);
            const result = await db.getSettings();
            expect(result?.ack).toBeUndefined();
            expect(result?.greeting).toBeUndefined();
            expect(result?.failure).toBeUndefined();
        });
    });

    describe('getThreadById / saveThread', () => {
        it('should return undefined for unknown threadId', async () => {
            const result = await db.getThreadById('nonexistent');
            expect(result).toBeUndefined();
        });

        it('should save and retrieve a thread by ID', async () => {
            await db.saveThread(sampleThread);
            const result = await db.getThreadById('11111');
            expect(result?.threadId).toBe('11111');
            expect(result?.userId).toBe('123456');
            expect(result?.name).toBe(sampleThread.name);
        });

        it('should update existing thread on second save', async () => {
            await db.saveThread(sampleThread);
            const updated = { ...sampleThread, unreadCount: 5, updatedAt: '2023-02-01T00:00:00.000Z' };
            await db.saveThread(updated);
            const result = await db.getThreadById('11111');
            expect(result?.unreadCount).toBe(5);
        });
    });

    describe('getThreadByUserId', () => {
        it('should return undefined for unknown userId', async () => {
            const result = await db.getThreadByUserId('nonexistent');
            expect(result).toBeUndefined();
        });

        it('should retrieve the most recently updated thread for a user', async () => {
            const thread1 = { ...sampleThread, threadId: '11111', updatedAt: '2023-01-01T00:00:00.000Z' };
            const thread2 = {
                ...sampleThread,
                threadId: '22222',
                updatedAt: '2023-02-01T00:00:00.000Z',
                userId: '123456',
            };
            // Insert second thread's foreign key
            db['db']
                .prepare(
                    `INSERT OR IGNORE INTO threads (user_id, thread_id, name, last_message_id, unread_count, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                )
                .run('123456', '22222', 'Test2', 'msg_002', 0, '2023-02-01T00:00:00.000Z', '2023-02-01T00:00:00.000Z');
            await db.saveThread(thread1);
            await db.saveThread(thread2);
            const result = await db.getThreadByUserId('123456');
            expect(result?.threadId).toBe('22222');
        });
    });

    describe('saveMessage / getMessagesByUserId', () => {
        it('should return empty array when no messages', async () => {
            const result = await db.getMessagesByUserId('unknown');
            expect(result).toEqual([]);
        });

        it('should save and retrieve a message', async () => {
            await db.saveMessage(sampleMessage);
            const result = await db.getMessagesByUserId('123456');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('msg_001');
            expect(result[0].text).toBe('Hello world');
        });

        it('should retrieve messages in descending timestamp order', async () => {
            const msg1: SavedMessage = {
                ...sampleMessage,
                id: 'msg_a',
                timestamp: '2023-01-01T00:00:00.000Z',
            };
            const msg2: SavedMessage = {
                ...sampleMessage,
                id: 'msg_b',
                timestamp: '2023-01-02T00:00:00.000Z',
            };
            await db.saveMessage(msg1);
            await db.saveMessage(msg2);
            const result = await db.getMessagesByUserId('123456');
            expect(result[0].id).toBe('msg_b');
            expect(result[1].id).toBe('msg_a');
        });

        it('should handle messages with all optional fields', async () => {
            const fullMessage: SavedMessage = {
                ...sampleMessage,
                forwardOrigin: { date: 1234567890, type: 'user' },
                id: 'msg_full',
                originalMessageId: 'msg_orig',
                quote: 'Quoted text',
                replyToMessageId: 'msg_reply',
            };
            await db.saveMessage(fullMessage);
            const result = await db.getMessagesByUserId('123456');
            const found = result.find((m) => m.id === 'msg_full');
            expect(found?.quote).toBe('Quoted text');
            expect(found?.originalMessageId).toBe('msg_orig');
            expect(found?.replyToMessageId).toBe('msg_reply');
            expect(found?.forwardOrigin).toBeDefined();
        });

        it('should handle messages with minimal fields', async () => {
            const minimal: SavedMessage = {
                chatId: '123456',
                from: { userId: '123456' },
                id: 'msg_min',
                text: '',
                timestamp: '2023-01-01T00:00:00.000Z',
                type: 'user',
            };
            await db.saveMessage(minimal);
            const result = await db.getMessagesByUserId('123456');
            const found = result.find((m) => m.id === 'msg_min');
            expect(found).toBeDefined();
            expect(found?.caption).toBeUndefined();
            expect(found?.mediaType).toBeUndefined();
        });

        it('should replace message with same id on second insert', async () => {
            await db.saveMessage(sampleMessage);
            const updated = { ...sampleMessage, text: 'Updated text' };
            await db.saveMessage(updated);
            const result = await db.getMessagesByUserId('123456');
            expect(result).toHaveLength(1);
            expect(result[0].text).toBe('Updated text');
        });
    });

    describe('getAllThreads', () => {
        it('should return empty array when no threads', async () => {
            // Use a fresh db
            const freshDb = new SQLiteService(':memory:');
            const result = await freshDb.getAllThreads();
            expect(result).toEqual([]);
            freshDb.close();
        });

        it('should return threads ordered by updatedAt desc', async () => {
            const t1 = { ...sampleThread, threadId: '11111', updatedAt: '2023-01-01T00:00:00.000Z' };
            const t2 = {
                ...sampleThread,
                threadId: '22222',
                updatedAt: '2023-03-01T00:00:00.000Z',
                userId: 'user2',
            };
            const t3 = {
                ...sampleThread,
                threadId: '33333',
                updatedAt: '2023-02-01T00:00:00.000Z',
                userId: 'user3',
            };
            // Insert foreign keys for extra users
            db['db']
                .prepare(
                    `INSERT OR IGNORE INTO threads (user_id, thread_id, name, last_message_id, unread_count, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                )
                .run('user2', '22222', 'User2', 'msg', 0, '2023-03-01T00:00:00.000Z', '2023-03-01T00:00:00.000Z');
            db['db']
                .prepare(
                    `INSERT OR IGNORE INTO threads (user_id, thread_id, name, last_message_id, unread_count, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                )
                .run('user3', '33333', 'User3', 'msg', 0, '2023-02-01T00:00:00.000Z', '2023-02-01T00:00:00.000Z');
            await db.saveThread(t1);
            await db.saveThread(t2);
            await db.saveThread(t3);
            const result = await db.getAllThreads();
            expect(result[0].threadId).toBe('22222');
            expect(result[1].threadId).toBe('33333');
            expect(result[2].threadId).toBe('11111');
        });

        it('should paginate with limit and offset', async () => {
            // Insert 3 different threads (seeded one already exists)
            await db.saveThread(sampleThread);
            for (let i = 2; i <= 4; i++) {
                db['db']
                    .prepare(
                        `INSERT OR REPLACE INTO threads (user_id, thread_id, name, last_message_id, unread_count, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    )
                    .run(
                        `user${i}`,
                        `thread${i}`,
                        `User${i}`,
                        'msg',
                        0,
                        `2023-0${i}-01T00:00:00.000Z`,
                        `2023-0${i}-01T00:00:00.000Z`,
                    );
            }
            const page1 = await db.getAllThreads({ limit: 2, offset: 0 });
            expect(page1).toHaveLength(2);
            const page2 = await db.getAllThreads({ limit: 2, offset: 2 });
            expect(page2).toHaveLength(2);
        });
    });

    describe('getThreadCount', () => {
        it('should return 0 for empty database', async () => {
            const freshDb = new SQLiteService(':memory:');
            const result = await freshDb.getThreadCount();
            expect(result).toBe(0);
            freshDb.close();
        });

        it('should return correct count after inserting threads', async () => {
            await db.saveThread(sampleThread);
            const result = await db.getThreadCount();
            expect(result).toBe(1);
        });
    });

    describe('getUnreadCount', () => {
        it('should return 0 for unknown user', async () => {
            const result = await db.getUnreadCount('unknown');
            expect(result).toBe(0);
        });

        it('should return the unread count for a known thread', async () => {
            await db.saveThread(sampleThread);
            const result = await db.getUnreadCount('123456');
            expect(result).toBe(2);
        });
    });

    describe('markThreadRead', () => {
        it('should set unread count to 0', async () => {
            await db.saveThread(sampleThread);
            await db.markThreadRead('123456');
            const result = await db.getUnreadCount('123456');
            expect(result).toBe(0);
        });

        it('should not throw for unknown userId', async () => {
            await expect(db.markThreadRead('nonexistent')).resolves.toBeUndefined();
        });
    });
});

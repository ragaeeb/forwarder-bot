import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { BotSettings, SavedMessage, ThreadData } from '@/types/app.js';

import { TursoDataService } from './turso.js';

const mockExecute = mock(() => Promise.resolve({ rows: [], columns: [], rowsAffected: 0 }));
const mockBatch = mock(() => Promise.resolve([]));
const mockCreateClient = mock(() => ({
    execute: mockExecute,
    batch: mockBatch,
}));

mock.module('@libsql/client', () => ({
    createClient: mockCreateClient,
}));

describe('TursoDataService', () => {
    let service: TursoDataService;

    beforeEach(() => {
        mockExecute.mockClear();
        mockBatch.mockClear();
        service = new TursoDataService({
            url: 'libsql://test.db',
            authToken: 'test-token',
        });
    });

    describe('constructor', () => {
        it('should create client with url and authToken', () => {
            new TursoDataService({ url: 'libsql://x.db', authToken: 'tok' });
            expect(mockCreateClient).toHaveBeenCalledWith({
                url: 'libsql://x.db',
                authToken: 'tok',
            });
        });
    });

    describe('initialize', () => {
        it('should run schema SQL via batch', async () => {
            await service.initialize();
            expect(mockBatch).toHaveBeenCalledTimes(1);
            const statements = mockBatch.mock.calls[0][0];
            expect(statements).toBeInstanceOf(Array);
            expect(statements.some((s: string) => s.includes('CREATE TABLE') && s.includes('config'))).toBe(true);
            expect(statements.some((s: string) => s.includes('CREATE TABLE') && s.includes('threads'))).toBe(true);
            expect(statements.some((s: string) => s.includes('CREATE TABLE') && s.includes('messages'))).toBe(true);
        });
    });

    describe('getSettings', () => {
        it('should return settings when config exists', async () => {
            const mockConfig: BotSettings = {
                adminGroupId: 'admin-123',
                setupAt: '2023-01-01T00:00:00Z',
                setupBy: { first_name: 'Admin', id: 123, is_bot: false },
            };
            mockExecute.mockResolvedValueOnce({
                rows: [
                    {
                        config_id: 'main',
                        admin_group_id: 'admin-123',
                        setup_at: '2023-01-01T00:00:00Z',
                        setup_by: JSON.stringify(mockConfig.setupBy),
                    },
                ],
                columns: [],
                rowsAffected: 0,
            });

            const result = await service.getSettings();

            expect(mockExecute).toHaveBeenCalledWith({
                sql: expect.stringContaining('SELECT * FROM config WHERE config_id = ?'),
                args: ['main'],
            });
            expect(result).toEqual(mockConfig);
        });

        it('should return undefined when config not found', async () => {
            mockExecute.mockResolvedValueOnce({ rows: [], columns: [], rowsAffected: 0 });

            const result = await service.getSettings();

            expect(result).toBeUndefined();
        });
    });

    describe('getMessagesByUserId', () => {
        it('should return messages for user', async () => {
            const mockMessages = [
                {
                    id: 'msg1',
                    user_id: 'user123',
                    chat_id: 'chat1',
                    from_user_id: 'user123',
                    text: 'Hello',
                    timestamp: '2023-01-01T00:00:00Z',
                    type: 'user',
                },
            ];
            mockExecute.mockResolvedValueOnce({
                rows: mockMessages,
                columns: [],
                rowsAffected: 0,
            });

            const result = await service.getMessagesByUserId('user123');

            expect(mockExecute).toHaveBeenCalledWith({
                sql: expect.stringContaining('SELECT * FROM messages WHERE user_id = ?'),
                args: ['user123'],
            });
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('msg1');
            expect(result[0].from.userId).toBe('user123');
        });

        it('should return empty array when no messages', async () => {
            mockExecute.mockResolvedValueOnce({ rows: [], columns: [], rowsAffected: 0 });

            const result = await service.getMessagesByUserId('user123');

            expect(result).toEqual([]);
        });
    });

    describe('getThreadById', () => {
        it('should return thread when found', async () => {
            const mockThread = {
                user_id: 'user123',
                thread_id: 'thread456',
                name: 'Test',
                last_message_id: 'msg1',
                created_at: '2023-01-01T00:00:00Z',
                updated_at: '2023-01-01T00:01:00Z',
            };
            mockExecute.mockResolvedValueOnce({
                rows: [mockThread],
                columns: [],
                rowsAffected: 0,
            });

            const result = await service.getThreadById('thread456');

            expect(mockExecute).toHaveBeenCalledWith({
                sql: expect.stringContaining('SELECT * FROM threads WHERE thread_id = ?'),
                args: ['thread456'],
            });
            expect(result).toEqual({
                userId: 'user123',
                threadId: 'thread456',
                name: 'Test',
                lastMessageId: 'msg1',
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-01-01T00:01:00Z',
            });
        });

        it('should return undefined when thread not found', async () => {
            mockExecute.mockResolvedValueOnce({ rows: [], columns: [], rowsAffected: 0 });

            const result = await service.getThreadById('unknown');

            expect(result).toBeUndefined();
        });
    });

    describe('getThreadByUserId', () => {
        it('should return most recent thread for user', async () => {
            const mockThread = {
                user_id: 'user123',
                thread_id: 'thread1',
                name: 'Thread',
                last_message_id: 'msg1',
                created_at: '2023-01-01T00:00:00Z',
                updated_at: '2023-01-01T00:01:00Z',
            };
            mockExecute.mockResolvedValueOnce({
                rows: [mockThread],
                columns: [],
                rowsAffected: 0,
            });

            const result = await service.getThreadByUserId('user123');

            expect(mockExecute).toHaveBeenCalledWith({
                sql: expect.stringContaining('SELECT * FROM threads WHERE user_id = ?'),
                args: ['user123'],
            });
            expect(result?.userId).toBe('user123');
        });

        it('should return undefined when no thread', async () => {
            mockExecute.mockResolvedValueOnce({ rows: [], columns: [], rowsAffected: 0 });

            const result = await service.getThreadByUserId('unknown');

            expect(result).toBeUndefined();
        });
    });

    describe('saveMessage', () => {
        it('should insert message with correct parameters', async () => {
            const message: SavedMessage = {
                id: 'msg1',
                chatId: 'chat1',
                from: { userId: 'user123', firstName: 'John' },
                text: 'Hello',
                timestamp: '2023-01-01T00:00:00Z',
                type: 'user',
            };
            mockExecute.mockResolvedValueOnce({ rows: [], columns: [], rowsAffected: 1 });

            const result = await service.saveMessage(message);

            expect(mockExecute).toHaveBeenCalledWith({
                sql: expect.stringContaining('INSERT OR REPLACE INTO messages'),
                args: expect.arrayContaining([
                    'msg1',
                    'user123',
                    'chat1',
                    'user123',
                    'John',
                    null,
                    null,
                    'Hello',
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    'user',
                    '2023-01-01T00:00:00Z',
                ]),
            });
            expect(result).toEqual(message);
        });
    });

    describe('saveSettings', () => {
        it('should save config with setupBy as JSON', async () => {
            const config: BotSettings = {
                adminGroupId: 'admin-123',
                setupAt: '2023-01-01T00:00:00Z',
                setupBy: { first_name: 'Admin', id: 123, is_bot: false },
            };
            mockExecute.mockResolvedValueOnce({ rows: [], columns: [], rowsAffected: 1 });

            const result = await service.saveSettings(config);

            expect(mockExecute).toHaveBeenCalledWith({
                sql: expect.stringContaining('INSERT OR REPLACE INTO config'),
                args: expect.arrayContaining(['main', 'admin-123', '2023-01-01T00:00:00Z']),
            });
            const setupByArg = mockExecute.mock.calls[0][0].args[6];
            expect(setupByArg).toBe(JSON.stringify(config.setupBy));
            expect(result).toEqual(config);
        });
    });

    describe('saveThread', () => {
        it('should upsert thread with ON CONFLICT', async () => {
            const thread: ThreadData = {
                userId: 'user123',
                threadId: 'thread1',
                name: 'Thread',
                lastMessageId: 'msg1',
                createdAt: '2023-01-01T00:00:00Z',
                updatedAt: '2023-01-01T00:01:00Z',
            };
            mockExecute.mockResolvedValueOnce({ rows: [], columns: [], rowsAffected: 1 });

            const result = await service.saveThread(thread);

            expect(mockExecute).toHaveBeenCalledWith({
                sql: expect.stringContaining('INSERT INTO threads'),
                args: expect.arrayContaining([
                    'user123',
                    'thread1',
                    'Thread',
                    'msg1',
                    '2023-01-01T00:01:00Z',
                    '2023-01-01T00:00:00Z',
                ]),
            });
            expect(result).toEqual(thread);
        });
    });

    describe('getAllThreads', () => {
        it('should return threads with limit and offset', async () => {
            const mockThreads = [
                {
                    user_id: 'user1',
                    thread_id: 't1',
                    name: 'T1',
                    last_message_id: 'm1',
                    created_at: '2023-01-01',
                    updated_at: '2023-01-02',
                },
            ];
            mockExecute.mockResolvedValueOnce({
                rows: mockThreads,
                columns: [],
                rowsAffected: 0,
            });

            const result = await service.getAllThreads({ limit: 10, offset: 5 });

            expect(mockExecute).toHaveBeenCalledWith({
                sql: expect.stringContaining('ORDER BY updated_at DESC LIMIT ? OFFSET ?'),
                args: [10, 5],
            });
            expect(result).toHaveLength(1);
        });

        it('should use default limit and offset', async () => {
            mockExecute.mockResolvedValueOnce({ rows: [], columns: [], rowsAffected: 0 });

            await service.getAllThreads();

            expect(mockExecute).toHaveBeenCalledWith({
                sql: expect.stringContaining('LIMIT ? OFFSET ?'),
                args: [100, 0],
            });
        });
    });

    describe('getThreadCount', () => {
        it('should return count of threads', async () => {
            mockExecute.mockResolvedValueOnce({
                rows: [{ count: 42 }],
                columns: [],
                rowsAffected: 0,
            });

            const result = await service.getThreadCount();

            expect(mockExecute).toHaveBeenCalledWith({
                sql: expect.stringContaining('SELECT COUNT(*)'),
                args: [],
            });
            expect(result).toBe(42);
        });
    });

    describe('getUnreadCount', () => {
        it('should return sum of unread_count for user', async () => {
            mockExecute.mockResolvedValueOnce({
                rows: [{ total: 5 }],
                columns: [],
                rowsAffected: 0,
            });

            const result = await service.getUnreadCount('user123');

            expect(mockExecute).toHaveBeenCalledWith({
                sql: expect.stringContaining('SUM(unread_count)'),
                args: ['user123'],
            });
            expect(result).toBe(5);
        });
    });

    describe('markThreadRead', () => {
        it('should update unread_count to 0 for user', async () => {
            mockExecute.mockResolvedValueOnce({ rows: [], columns: [], rowsAffected: 2 });

            await service.markThreadRead('user123');

            expect(mockExecute).toHaveBeenCalledWith({
                sql: expect.stringContaining('UPDATE threads SET unread_count = 0'),
                args: ['user123'],
            });
        });
    });
});

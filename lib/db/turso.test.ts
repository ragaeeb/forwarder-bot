import { beforeEach, describe, expect, it, mock } from 'bun:test';

import type { BotSettings, SavedMessage, ThreadData } from '../../src/types/app.js';

// Mock @libsql/client entirely — no real network calls
const mockExecute = mock(() => {});
const mockClient = { execute: mockExecute };

mock.module('@libsql/client', () => ({
    createClient: mock(() => mockClient),
}));

const { TursoService } = await import('./turso.js');

describe('TursoService', () => {
    let service: InstanceType<typeof TursoService>;

    const sampleSettings: BotSettings = {
        ack: 'Got it',
        adminGroupId: '-100123456789',
        setupAt: '2023-01-01T00:00:00.000Z',
        setupBy: { first_name: 'Admin', id: 1, is_bot: false },
    };

    const sampleThread: ThreadData = {
        createdAt: '2023-01-01T00:00:00.000Z',
        lastMessageId: 'msg_001',
        name: 'Test User',
        threadId: '11111',
        unreadCount: 3,
        updatedAt: '2023-01-02T00:00:00.000Z',
        userId: '123456',
    };

    const sampleMessage: SavedMessage = {
        chatId: '123456',
        from: { firstName: 'Test', userId: '123456' },
        id: 'msg_001',
        text: 'Hello',
        timestamp: '2023-01-01T00:00:00.000Z',
        type: 'user',
    };

    beforeEach(() => {
        mock.restore();
        mockExecute.mockResolvedValue({ rows: [] });
        service = new TursoService('libsql://test.turso.io', 'test-token');
    });

    describe('constructor', () => {
        it('should create a TursoService instance', () => {
            expect(service).toBeInstanceOf(TursoService);
        });

        it('should call createClient with the provided url and authToken', async () => {
            const { createClient } = await import('@libsql/client');
            expect(createClient).toHaveBeenCalledWith({ authToken: 'test-token', url: 'libsql://test.turso.io' });
        });
    });

    describe('initialize', () => {
        it('should execute SQL schema statements', async () => {
            await service.initialize();
            expect(mockExecute).toHaveBeenCalled();
        });
    });

    describe('getSettings', () => {
        it('should return undefined when no rows', async () => {
            mockExecute.mockResolvedValue({ rows: [] });
            const result = await service.getSettings();
            expect(result).toBeUndefined();
        });

        it('should return settings when row exists', async () => {
            mockExecute.mockResolvedValue({
                rows: [
                    {
                        ack: 'Got it',
                        admin_group_id: '-100123456789',
                        config_id: 'main',
                        failure: null,
                        greeting: null,
                        setup_at: '2023-01-01T00:00:00.000Z',
                        setup_by: JSON.stringify({ first_name: 'Admin', id: 1, is_bot: false }),
                    },
                ],
            });
            const result = await service.getSettings();
            expect(result?.adminGroupId).toBe('-100123456789');
            expect(result?.ack).toBe('Got it');
        });

        it('should call execute with correct SQL and args', async () => {
            await service.getSettings();
            expect(mockExecute).toHaveBeenCalledWith(
                expect.objectContaining({
                    args: ['main'],
                    sql: expect.stringContaining('config'),
                }),
            );
        });
    });

    describe('saveSettings', () => {
        it('should call execute with INSERT OR REPLACE', async () => {
            await service.saveSettings(sampleSettings);
            expect(mockExecute).toHaveBeenCalledWith(
                expect.objectContaining({
                    args: expect.arrayContaining(['main', '-100123456789']),
                    sql: expect.stringContaining('INSERT OR REPLACE INTO config'),
                }),
            );
        });

        it('should return the settings unchanged', async () => {
            const result = await service.saveSettings(sampleSettings);
            expect(result).toEqual(sampleSettings);
        });

        it('should propagate errors from execute', async () => {
            mockExecute.mockRejectedValue(new Error('DB error'));
            await expect(service.saveSettings(sampleSettings)).rejects.toThrow('DB error');
        });
    });

    describe('getThreadById', () => {
        it('should return undefined when no rows', async () => {
            mockExecute.mockResolvedValue({ rows: [] });
            const result = await service.getThreadById('nonexistent');
            expect(result).toBeUndefined();
        });

        it('should return thread when row exists', async () => {
            mockExecute.mockResolvedValue({
                rows: [
                    {
                        created_at: '2023-01-01T00:00:00.000Z',
                        last_message_at: null,
                        last_message_id: 'msg_001',
                        name: 'Test User',
                        thread_id: '11111',
                        unread_count: 3,
                        updated_at: '2023-01-02T00:00:00.000Z',
                        user_id: '123456',
                    },
                ],
            });
            const result = await service.getThreadById('11111');
            expect(result?.threadId).toBe('11111');
            expect(result?.userId).toBe('123456');
        });

        it('should call execute with correct SQL and threadId', async () => {
            await service.getThreadById('thread123');
            expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({ args: ['thread123'] }));
        });
    });

    describe('getThreadByUserId', () => {
        it('should return undefined when no rows', async () => {
            mockExecute.mockResolvedValue({ rows: [] });
            const result = await service.getThreadByUserId('unknown');
            expect(result).toBeUndefined();
        });

        it('should return thread when row exists', async () => {
            mockExecute.mockResolvedValue({
                rows: [
                    {
                        created_at: '2023-01-01T00:00:00.000Z',
                        last_message_at: null,
                        last_message_id: 'msg_001',
                        name: 'Test',
                        thread_id: '11111',
                        unread_count: 0,
                        updated_at: '2023-01-02T00:00:00.000Z',
                        user_id: '123456',
                    },
                ],
            });
            const result = await service.getThreadByUserId('123456');
            expect(result?.userId).toBe('123456');
        });
    });

    describe('saveThread', () => {
        it('should call execute with INSERT OR REPLACE INTO threads', async () => {
            await service.saveThread(sampleThread);
            expect(mockExecute).toHaveBeenCalledWith(
                expect.objectContaining({
                    args: expect.arrayContaining(['123456', '11111']),
                    sql: expect.stringContaining('INSERT OR REPLACE INTO threads'),
                }),
            );
        });

        it('should return the thread unchanged', async () => {
            const result = await service.saveThread(sampleThread);
            expect(result).toEqual(sampleThread);
        });

        it('should propagate errors', async () => {
            mockExecute.mockRejectedValue(new Error('DB error'));
            await expect(service.saveThread(sampleThread)).rejects.toThrow('DB error');
        });
    });

    describe('saveMessage', () => {
        it('should call execute with INSERT OR REPLACE INTO messages', async () => {
            await service.saveMessage(sampleMessage);
            expect(mockExecute).toHaveBeenCalledWith(
                expect.objectContaining({
                    sql: expect.stringContaining('INSERT OR REPLACE INTO messages'),
                }),
            );
        });

        it('should return the message unchanged', async () => {
            const result = await service.saveMessage(sampleMessage);
            expect(result).toEqual(sampleMessage);
        });

        it('should propagate errors', async () => {
            mockExecute.mockRejectedValue(new Error('DB error'));
            await expect(service.saveMessage(sampleMessage)).rejects.toThrow('DB error');
        });
    });

    describe('getMessagesByUserId', () => {
        it('should return empty array when no rows', async () => {
            mockExecute.mockResolvedValue({ rows: [] });
            const result = await service.getMessagesByUserId('unknown');
            expect(result).toEqual([]);
        });

        it('should return messages from rows', async () => {
            mockExecute.mockResolvedValue({
                rows: [
                    {
                        caption: null,
                        chat_id: '123456',
                        forward_origin: null,
                        from_first_name: 'Test',
                        from_last_name: null,
                        from_user_id: '123456',
                        from_username: null,
                        id: 'msg_001',
                        media_id: null,
                        media_type: null,
                        message_id: 'msg_001',
                        original_message_id: null,
                        quote: null,
                        reply_to_message_id: null,
                        text: 'Hello',
                        timestamp: '2023-01-01T00:00:00.000Z',
                        type: 'user',
                        user_id: '123456',
                    },
                ],
            });
            const result = await service.getMessagesByUserId('123456');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('msg_001');
        });
    });

    describe('getAllThreads', () => {
        it('should return empty array when no rows', async () => {
            mockExecute.mockResolvedValue({ rows: [] });
            const result = await service.getAllThreads();
            expect(result).toEqual([]);
        });

        it('should call execute with LIMIT and OFFSET', async () => {
            await service.getAllThreads({ limit: 10, offset: 20 });
            expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({ args: [10, 20] }));
        });

        it('should use default limit 50 and offset 0', async () => {
            await service.getAllThreads();
            expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({ args: [50, 0] }));
        });
    });

    describe('getThreadCount', () => {
        it('should return count from result', async () => {
            mockExecute.mockResolvedValue({ rows: [{ count: 7 }] });
            const result = await service.getThreadCount();
            expect(result).toBe(7);
        });
    });

    describe('getUnreadCount', () => {
        it('should return 0 when no rows', async () => {
            mockExecute.mockResolvedValue({ rows: [] });
            const result = await service.getUnreadCount('unknown');
            expect(result).toBe(0);
        });

        it('should return the unread count from the first row', async () => {
            mockExecute.mockResolvedValue({ rows: [{ unread_count: 5 }] });
            const result = await service.getUnreadCount('user123');
            expect(result).toBe(5);
        });
    });

    describe('markThreadRead', () => {
        it('should call execute with UPDATE threads SET unread_count = 0', async () => {
            await service.markThreadRead('user123');
            expect(mockExecute).toHaveBeenCalledWith(
                expect.objectContaining({
                    args: ['user123'],
                    sql: expect.stringContaining('UPDATE threads SET unread_count = 0'),
                }),
            );
        });
    });
});

import { beforeEach, describe, expect, it, mock } from 'bun:test';

import type { BotSettings, SavedMessage, ThreadData } from '../../src/types/app.js';

// Mock mongoose entirely — no real network calls
const mockExec = mock(() => {});
const mockLean = mock(() => ({ exec: mockExec }));
const mockSort = mock(() => ({ lean: mockLean, skip: mockSkip }));
const mockSkip = mock(() => ({ limit: mockLimit }));
const mockLimit = mock(() => ({ lean: mockLean }));
const mockFind = mock(() => ({ lean: mockLean, sort: mockSort }));
const mockFindOne = mock(() => ({ exec: mockExec, lean: mockLean, sort: mockSort }));
const mockFindOneAndUpdate = mock(() => ({ exec: mockExec }));
const mockUpdateMany = mock(() => ({ exec: mockExec }));
const mockCountDocuments = mock(() => ({ exec: mockExec }));
const mockModel = mock(() => ({
    countDocuments: mockCountDocuments,
    find: mockFind,
    findOne: mockFindOne,
    findOneAndUpdate: mockFindOneAndUpdate,
    updateMany: mockUpdateMany,
}));
const mockCreateConnection = mock(() => ({
    close: mock(() => Promise.resolve()),
    model: mockModel,
}));

mock.module('mongoose', () => ({
    Schema: class MockSchema {
        constructor() {}
        index() {
            return this;
        }
        Types = { Mixed: {} };
    },
    createConnection: mockCreateConnection,
    default: {
        Schema: class MockSchema {
            constructor() {}
            index() {
                return this;
            }
            Types = { Mixed: {} };
        },
        createConnection: mockCreateConnection,
    },
}));

const { MongoDBService } = await import('./mongodb.js');

describe('MongoDBService', () => {
    let service: InstanceType<typeof MongoDBService>;

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
        mockExec.mockResolvedValue(null);
        service = new MongoDBService('mongodb://localhost:27017/test');
    });

    describe('constructor', () => {
        it('should create a MongoDBService instance', () => {
            expect(service).toBeInstanceOf(MongoDBService);
        });

        it('should call createConnection with the URI', () => {
            expect(mockCreateConnection).toHaveBeenCalledWith('mongodb://localhost:27017/test');
        });
    });

    describe('getSettings', () => {
        it('should return undefined when no doc found', async () => {
            mockExec.mockResolvedValue(null);
            // findOne returns chainable object, lean().exec() returns null
            mockFindOne.mockReturnValue({
                exec: mockExec,
                lean: mock(() => ({ exec: mock(() => Promise.resolve(null)) })),
                sort: mockSort,
            });
            const result = await service.getSettings();
            expect(result).toBeUndefined();
        });

        it('should call findOne with configId: main', async () => {
            const mockFindOneFn = mock(() => ({
                exec: mockExec,
                lean: mock(() => ({ exec: mockExec })),
                sort: mockSort,
            }));
            service['ConfigModel'].findOne = mockFindOneFn;
            mockExec.mockResolvedValue(null);
            await service.getSettings();
            expect(mockFindOneFn).toHaveBeenCalledWith({ configId: 'main' });
        });

        it('should return settings when doc exists', async () => {
            const doc = {
                ack: 'Got it',
                adminGroupId: '-100123456789',
                configId: 'main',
                setupAt: '2023-01-01T00:00:00.000Z',
                setupBy: { first_name: 'Admin', id: 1, is_bot: false },
            };
            service['ConfigModel'].findOne = mock(() => ({
                lean: mock(() => ({ exec: mock(() => Promise.resolve(doc)) })),
            })) as any;
            const result = await service.getSettings();
            expect(result?.adminGroupId).toBe('-100123456789');
        });
    });

    describe('saveSettings', () => {
        it('should call findOneAndUpdate with upsert: true', async () => {
            const mockFOAU = mock(() => ({ exec: mock(() => Promise.resolve({})) }));
            service['ConfigModel'].findOneAndUpdate = mockFOAU as any;
            await service.saveSettings(sampleSettings);
            expect(mockFOAU).toHaveBeenCalledWith(
                { configId: 'main' },
                expect.objectContaining({ adminGroupId: '-100123456789', configId: 'main' }),
                { upsert: true },
            );
        });

        it('should return the settings unchanged', async () => {
            service['ConfigModel'].findOneAndUpdate = mock(() => ({ exec: mock(() => Promise.resolve({})) })) as any;
            const result = await service.saveSettings(sampleSettings);
            expect(result).toEqual(sampleSettings);
        });

        it('should propagate errors', async () => {
            service['ConfigModel'].findOneAndUpdate = mock(() => ({
                exec: mock(() => Promise.reject(new Error('DB error'))),
            })) as any;
            await expect(service.saveSettings(sampleSettings)).rejects.toThrow('DB error');
        });
    });

    describe('getThreadById', () => {
        it('should return undefined when not found', async () => {
            service['ThreadModel'].findOne = mock(() => ({
                lean: mock(() => ({ exec: mock(() => Promise.resolve(null)) })),
            })) as any;
            const result = await service.getThreadById('nonexistent');
            expect(result).toBeUndefined();
        });

        it('should return thread when found', async () => {
            service['ThreadModel'].findOne = mock(() => ({
                lean: mock(() => ({ exec: mock(() => Promise.resolve(sampleThread)) })),
            })) as any;
            const result = await service.getThreadById('11111');
            expect(result?.threadId).toBe('11111');
        });

        it('should call findOne with threadId', async () => {
            const mockFOFn = mock(() => ({ lean: mock(() => ({ exec: mock(() => Promise.resolve(null)) })) }));
            service['ThreadModel'].findOne = mockFOFn as any;
            await service.getThreadById('thread123');
            expect(mockFOFn).toHaveBeenCalledWith({ threadId: 'thread123' });
        });
    });

    describe('getThreadByUserId', () => {
        it('should return undefined when not found', async () => {
            service['ThreadModel'].findOne = mock(() => ({
                sort: mock(() => ({ lean: mock(() => ({ exec: mock(() => Promise.resolve(null)) })) })),
            })) as any;
            const result = await service.getThreadByUserId('unknown');
            expect(result).toBeUndefined();
        });

        it('should return thread when found', async () => {
            service['ThreadModel'].findOne = mock(() => ({
                sort: mock(() => ({ lean: mock(() => ({ exec: mock(() => Promise.resolve(sampleThread)) })) })),
            })) as any;
            const result = await service.getThreadByUserId('123456');
            expect(result?.userId).toBe('123456');
        });
    });

    describe('saveThread', () => {
        it('should call findOneAndUpdate with thread data', async () => {
            const mockFOAU = mock(() => ({ exec: mock(() => Promise.resolve({})) }));
            service['ThreadModel'].findOneAndUpdate = mockFOAU as any;
            await service.saveThread(sampleThread);
            expect(mockFOAU).toHaveBeenCalledWith({ threadId: '11111', userId: '123456' }, sampleThread, {
                upsert: true,
            });
        });

        it('should return the thread unchanged', async () => {
            service['ThreadModel'].findOneAndUpdate = mock(() => ({ exec: mock(() => Promise.resolve({})) })) as any;
            const result = await service.saveThread(sampleThread);
            expect(result).toEqual(sampleThread);
        });
    });

    describe('saveMessage', () => {
        it('should call findOneAndUpdate with message id', async () => {
            const mockFOAU = mock(() => ({ exec: mock(() => Promise.resolve({})) }));
            service['MessageModel'].findOneAndUpdate = mockFOAU as any;
            await service.saveMessage(sampleMessage);
            expect(mockFOAU).toHaveBeenCalledWith({ id: 'msg_001' }, sampleMessage, { upsert: true });
        });

        it('should return the message unchanged', async () => {
            service['MessageModel'].findOneAndUpdate = mock(() => ({ exec: mock(() => Promise.resolve({})) })) as any;
            const result = await service.saveMessage(sampleMessage);
            expect(result).toEqual(sampleMessage);
        });
    });

    describe('getMessagesByUserId', () => {
        it('should return empty array when no messages', async () => {
            service['MessageModel'].find = mock(() => ({
                sort: mock(() => ({ lean: mock(() => ({ exec: mock(() => Promise.resolve([])) })) })),
            })) as any;
            const result = await service.getMessagesByUserId('unknown');
            expect(result).toEqual([]);
        });

        it('should return messages for user', async () => {
            service['MessageModel'].find = mock(() => ({
                sort: mock(() => ({ lean: mock(() => ({ exec: mock(() => Promise.resolve([sampleMessage])) })) })),
            })) as any;
            const result = await service.getMessagesByUserId('123456');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('msg_001');
        });

        it('should call find with the userId', async () => {
            const mockFindFn = mock(() => ({
                sort: mock(() => ({ lean: mock(() => ({ exec: mock(() => Promise.resolve([])) })) })),
            }));
            service['MessageModel'].find = mockFindFn as any;
            await service.getMessagesByUserId('user123');
            expect(mockFindFn).toHaveBeenCalledWith({ 'from.userId': 'user123' });
        });
    });

    describe('getAllThreads', () => {
        it('should return empty array when no threads', async () => {
            service['ThreadModel'].find = mock(() => ({
                sort: mock(() => ({
                    skip: mock(() => ({
                        limit: mock(() => ({ lean: mock(() => ({ exec: mock(() => Promise.resolve([])) })) })),
                    })),
                })),
            })) as any;
            const result = await service.getAllThreads();
            expect(result).toEqual([]);
        });

        it('should use default limit 50 and offset 0', async () => {
            const mockSkipFn = mock(() => ({
                limit: mock(() => ({ lean: mock(() => ({ exec: mock(() => Promise.resolve([])) })) })),
            }));
            const mockSortFn = mock(() => ({ skip: mockSkipFn }));
            service['ThreadModel'].find = mock(() => ({ sort: mockSortFn })) as any;
            await service.getAllThreads();
            expect(mockSkipFn).toHaveBeenCalledWith(0);
        });
    });

    describe('getThreadCount', () => {
        it('should return count', async () => {
            service['ThreadModel'].countDocuments = mock(() => ({
                exec: mock(() => Promise.resolve(5)),
            })) as any;
            const result = await service.getThreadCount();
            expect(result).toBe(5);
        });
    });

    describe('getUnreadCount', () => {
        it('should return 0 when thread not found', async () => {
            service['ThreadModel'].findOne = mock(() => ({
                sort: mock(() => ({ lean: mock(() => ({ exec: mock(() => Promise.resolve(null)) })) })),
            })) as any;
            const result = await service.getUnreadCount('unknown');
            expect(result).toBe(0);
        });

        it('should return unread count from thread', async () => {
            service['ThreadModel'].findOne = mock(() => ({
                sort: mock(() => ({
                    lean: mock(() => ({ exec: mock(() => Promise.resolve({ unreadCount: 7 })) })),
                })),
            })) as any;
            const result = await service.getUnreadCount('user123');
            expect(result).toBe(7);
        });
    });

    describe('markThreadRead', () => {
        it('should call updateMany with unreadCount: 0', async () => {
            const mockUMFn = mock(() => ({ exec: mock(() => Promise.resolve({})) }));
            service['ThreadModel'].updateMany = mockUMFn as any;
            await service.markThreadRead('user123');
            expect(mockUMFn).toHaveBeenCalledWith({ userId: 'user123' }, { $set: { unreadCount: 0 } });
        });
    });

    describe('close', () => {
        it('should close the connection', async () => {
            await service.close();
            expect(service['connection'].close).toHaveBeenCalled();
        });
    });
});

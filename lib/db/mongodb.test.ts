import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { BotSettings, SavedMessage, ThreadData } from '@/types/app.js';

import { MongoDataService } from './mongodb.js';

const mockConnect = mock(() => Promise.resolve());
const mockFindOne = mock(() => ({ lean: () => ({ exec: () => Promise.resolve(null) }) }));
const createFindChain = () => {
    const limitFn = mock(() => ({ lean: () => ({ exec: () => Promise.resolve([]) }) }));
    const skipFn = mock(() => ({ limit: limitFn }));
    const sortFn = mock(() => ({ skip: skipFn }));
    return { sort: sortFn, skip: skipFn, limit: limitFn, lean: () => ({ exec: () => Promise.resolve([]) }) };
};
const mockFind = mock(() => createFindChain());
const mockUpdateOne = mock(() => ({ exec: () => Promise.resolve({}) }));
const mockUpdateMany = mock(() => ({ exec: () => Promise.resolve({}) }));
const mockCountDocuments = mock(() => ({ exec: () => Promise.resolve(0) }));
const mockAggregate = mock(() => ({ exec: () => Promise.resolve([]) }));

const createMockModel = () => ({
    findOne: mockFindOne,
    find: mockFind,
    updateOne: mockUpdateOne,
    updateMany: mockUpdateMany,
    countDocuments: mockCountDocuments,
    aggregate: mockAggregate,
});

const mockModel = mock(createMockModel);

mock.module('mongoose', () => ({
    default: {
        connect: mockConnect,
        model: mockModel,
        Schema: Object,
        Types: { Mixed: Object },
    },
    Schema: Object,
    model: mockModel,
}));

describe('MongoDataService', () => {
    let service: MongoDataService;

    beforeEach(() => {
        mockConnect.mockClear();
        mockFindOne.mockClear();
        mockFind.mockClear();
        mockUpdateOne.mockClear();
        mockUpdateMany.mockClear();
        mockCountDocuments.mockClear();
        mockAggregate.mockClear();
        mockModel.mockClear();
        mockModel.mockImplementation((name: string) => createMockModel());
        service = new MongoDataService({ uri: 'mongodb://localhost:27017/test' });
    });

    describe('constructor', () => {
        it('should create models on construction', () => {
            expect(mockModel).toHaveBeenCalledWith('Config', expect.any(Object));
            expect(mockModel).toHaveBeenCalledWith('Thread', expect.any(Object));
            expect(mockModel).toHaveBeenCalledWith('Message', expect.any(Object));
        });
    });

    describe('connect', () => {
        it('should call mongoose.connect with uri', async () => {
            await service.connect();
            expect(mockConnect).toHaveBeenCalledWith('mongodb://localhost:27017/test');
        });
    });

    describe('getSettings', () => {
        it('should return settings when config exists', async () => {
            const mockConfig = {
                configId: 'main',
                adminGroupId: 'admin-123',
                setupAt: '2023-01-01T00:00:00Z',
                setupBy: { first_name: 'Admin', id: 123, is_bot: false },
            };
            mockFindOne.mockReturnValueOnce({
                lean: () => ({ exec: () => Promise.resolve(mockConfig) }),
            });

            const result = await service.getSettings();

            expect(mockFindOne).toHaveBeenCalledWith({ configId: 'main' });
            expect(result).toMatchObject({
                adminGroupId: 'admin-123',
                setupAt: '2023-01-01T00:00:00Z',
                setupBy: { first_name: 'Admin', id: 123, is_bot: false },
            });
        });

        it('should return undefined when config not found', async () => {
            mockFindOne.mockReturnValueOnce({
                lean: () => ({ exec: () => Promise.resolve(null) }),
            });

            const result = await service.getSettings();

            expect(result).toBeUndefined();
        });
    });

    describe('getMessagesByUserId', () => {
        it('should find messages by userId and sort by timestamp', async () => {
            const chain = {
                sort: mock(() => ({ lean: () => ({ exec: () => Promise.resolve([]) }) })),
            };
            mockFind.mockReturnValueOnce(chain);

            await service.getMessagesByUserId('user123');

            expect(mockFind).toHaveBeenCalledWith({ userId: 'user123' });
            expect(chain.sort).toHaveBeenCalledWith({ timestamp: -1 });
        });
    });

    describe('getThreadById', () => {
        it('should find thread by threadId', async () => {
            const mockThread = {
                userId: 'user123',
                threadId: 'thread1',
                name: 'Thread',
                lastMessageId: 'msg1',
                createdAt: '2023-01-01',
                updatedAt: '2023-01-02',
            };
            mockFindOne.mockReturnValueOnce({
                lean: () => ({ exec: () => Promise.resolve(mockThread) }),
            });

            const result = await service.getThreadById('thread1');

            expect(mockFindOne).toHaveBeenCalledWith({ threadId: 'thread1' });
            expect(result?.threadId).toBe('thread1');
        });

        it('should return undefined when not found', async () => {
            mockFindOne.mockReturnValueOnce({
                lean: () => ({ exec: () => Promise.resolve(null) }),
            });

            const result = await service.getThreadById('unknown');

            expect(result).toBeUndefined();
        });
    });

    describe('getThreadByUserId', () => {
        it('should find thread by userId with sort', async () => {
            const chain = {
                sort: mock(() => ({
                    lean: () => ({ exec: () => Promise.resolve(null) }),
                })),
            };
            mockFindOne.mockReturnValueOnce(chain);

            await service.getThreadByUserId('user123');

            expect(mockFindOne).toHaveBeenCalledWith({ userId: 'user123' });
            expect(chain.sort).toHaveBeenCalledWith({ updatedAt: -1 });
        });
    });

    describe('saveMessage', () => {
        it('should upsert message with correct data', async () => {
            const message: SavedMessage = {
                id: 'msg1',
                chatId: 'chat1',
                from: { userId: 'user123', firstName: 'John' },
                text: 'Hello',
                timestamp: '2023-01-01T00:00:00Z',
                type: 'user',
            };
            mockUpdateOne.mockReturnValueOnce({ exec: () => Promise.resolve({}) });

            const result = await service.saveMessage(message);

            expect(mockUpdateOne).toHaveBeenCalledWith(
                { id: 'msg1' },
                expect.objectContaining({
                    $set: expect.objectContaining({
                        id: 'msg1',
                        userId: 'user123',
                        chatId: 'chat1',
                        text: 'Hello',
                        type: 'user',
                    }),
                }),
                { upsert: true },
            );
            expect(result).toEqual(message);
        });
    });

    describe('saveSettings', () => {
        it('should upsert config', async () => {
            const config: BotSettings = {
                adminGroupId: 'admin-123',
                setupAt: '2023-01-01T00:00:00Z',
                setupBy: { first_name: 'Admin', id: 123, is_bot: false },
            };
            mockUpdateOne.mockReturnValueOnce({ exec: () => Promise.resolve({}) });

            const result = await service.saveSettings(config);

            expect(mockUpdateOne).toHaveBeenCalledWith(
                { configId: 'main' },
                expect.objectContaining({
                    $set: expect.objectContaining({
                        adminGroupId: 'admin-123',
                        setupAt: '2023-01-01T00:00:00Z',
                        setupBy: config.setupBy,
                    }),
                }),
                { upsert: true },
            );
            expect(result).toEqual(config);
        });
    });

    describe('saveThread', () => {
        it('should upsert thread', async () => {
            const thread: ThreadData = {
                userId: 'user123',
                threadId: 'thread1',
                name: 'Thread',
                lastMessageId: 'msg1',
                createdAt: '2023-01-01',
                updatedAt: '2023-01-02',
            };
            mockUpdateOne.mockReturnValueOnce({ exec: () => Promise.resolve({}) });

            const result = await service.saveThread(thread);

            expect(mockUpdateOne).toHaveBeenCalledWith(
                { userId: 'user123', threadId: 'thread1' },
                expect.objectContaining({
                    $set: expect.objectContaining({
                        name: 'Thread',
                        lastMessageId: 'msg1',
                        updatedAt: '2023-01-02',
                    }),
                    $setOnInsert: expect.objectContaining({
                        createdAt: '2023-01-01',
                        unreadCount: 0,
                    }),
                }),
                { upsert: true },
            );
            expect(result).toEqual(thread);
        });
    });

    describe('getAllThreads', () => {
        it('should find threads with sort, skip, limit', async () => {
            const chain = createFindChain();
            mockFind.mockReturnValueOnce(chain);

            await service.getAllThreads({ limit: 10, offset: 5 });

            expect(mockFind).toHaveBeenCalledWith();
            expect(chain.sort).toHaveBeenCalledWith({ updatedAt: -1 });
            expect(chain.skip).toHaveBeenCalledWith(5);
            expect(chain.limit).toHaveBeenCalledWith(10);
        });
    });

    describe('getThreadCount', () => {
        it('should return count of threads', async () => {
            mockCountDocuments.mockReturnValueOnce({ exec: () => Promise.resolve(42) });

            const result = await service.getThreadCount();

            expect(mockCountDocuments).toHaveBeenCalledWith();
            expect(result).toBe(42);
        });
    });

    describe('getUnreadCount', () => {
        it('should aggregate unread count for user', async () => {
            mockAggregate.mockReturnValueOnce({
                exec: () => Promise.resolve([{ total: 5 }]),
            });

            const result = await service.getUnreadCount('user123');

            expect(mockAggregate).toHaveBeenCalledWith(
                expect.arrayContaining([
                    { $match: { userId: 'user123' } },
                    { $group: { _id: null, total: { $sum: '$unreadCount' } } },
                ]),
            );
            expect(result).toBe(5);
        });

        it('should return 0 when no aggregation result', async () => {
            mockAggregate.mockReturnValueOnce({
                exec: () => Promise.resolve([]),
            });

            const result = await service.getUnreadCount('user123');

            expect(result).toBe(0);
        });
    });

    describe('markThreadRead', () => {
        it('should update unreadCount to 0 for user', async () => {
            mockUpdateMany.mockReturnValueOnce({ exec: () => Promise.resolve({}) });

            await service.markThreadRead('user123');

            expect(mockUpdateMany).toHaveBeenCalledWith({ userId: 'user123' }, { $set: { unreadCount: 0 } });
        });
    });
});

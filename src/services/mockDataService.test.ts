import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BotSettings, SavedMessage, ThreadData } from '../types.js';

import { MockDataService } from './mockDataService.js';

vi.mock('@/utils/logger.js', () => ({
    default: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
}));

describe('MockDataService', () => {
    let mockDataService: MockDataService;

    beforeEach(() => {
        vi.resetAllMocks();
        mockDataService = new MockDataService();
    });

    describe('constructor', () => {
        it('should initialize with empty messages and threads arrays', () => {
            expect(mockDataService['messages']).toEqual([]);
            expect(mockDataService['threads']).toEqual([]);
        });
    });

    describe('getSettings', () => {
        it('should return undefined when no config has been set', async () => {
            const config = await mockDataService.getSettings();
            expect(config).toBeUndefined();
        });

        it('should return the saved config when it exists', async () => {
            const botConfig: BotSettings = {
                adminGroupId: '12345',
                configId: 'test-config',
                setupAt: '2023-01-01T00:00:00Z',
                setupBy: {
                    first_name: 'Test',
                    id: 67890,
                    is_bot: false,
                },
            };

            await mockDataService.saveSettings(botConfig);
            const config = await mockDataService.getSettings();

            expect(config).toEqual(botConfig);
        });
    });

    describe('getMessagesByUserId', () => {
        it('should return an empty array when no messages exist for the user', async () => {
            const messages = await mockDataService.getMessagesByUserId('123');
            expect(messages).toEqual([]);
        });

        it('should return only messages for the specified user', async () => {
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

            await mockDataService.saveMessage(user1Message);
            await mockDataService.saveMessage(user2Message);

            const user1Messages = await mockDataService.getMessagesByUserId('123');
            expect(user1Messages).toEqual([user1Message]);

            const user2Messages = await mockDataService.getMessagesByUserId('456');
            expect(user2Messages).toEqual([user2Message]);
        });

        it('should return multiple messages for the same user in the order they were saved', async () => {
            const message1: SavedMessage = {
                chatId: '100',
                from: {
                    firstName: 'User1',
                    userId: '123',
                },
                id: '1',
                text: 'First message',
                timestamp: '2023-01-01T00:00:00Z',
                type: 'user',
            };

            const message2: SavedMessage = {
                chatId: '100',
                from: {
                    firstName: 'User1',
                    userId: '123',
                },
                id: '2',
                text: 'Second message',
                timestamp: '2023-01-01T00:01:00Z',
                type: 'user',
            };

            await mockDataService.saveMessage(message1);
            await mockDataService.saveMessage(message2);

            const messages = await mockDataService.getMessagesByUserId('123');
            expect(messages).toEqual([message1, message2]);
        });
    });

    describe('getThreadById', () => {
        it('should return undefined when no thread with the specified ID exists', async () => {
            const thread = await mockDataService.getThreadById('unknown-thread');
            expect(thread).toBeUndefined();
        });

        it('should return the thread with the specified ID when it exists', async () => {
            const threadData: ThreadData = {
                chatId: 'chat-789',
                createdAt: '2023-01-01T00:00:00Z',
                lastMessageId: 'msg-001',
                name: 'Test Thread',
                threadId: 'thread-123',
                updatedAt: '2023-01-01T00:00:00Z',
                userId: 'user-456',
            };

            await mockDataService.saveThread(threadData);

            const foundThread = await mockDataService.getThreadById('thread-123');
            expect(foundThread).toEqual(threadData);
        });
    });

    describe('getThreadByUserId', () => {
        it('should return undefined when no thread for the specified user exists', async () => {
            const thread = await mockDataService.getThreadByUserId('unknown-user');
            expect(thread).toBeUndefined();
        });

        it('should return the thread for the specified user when it exists', async () => {
            const threadData: ThreadData = {
                chatId: 'chat-789',
                createdAt: '2023-01-01T00:00:00Z',
                lastMessageId: 'msg-001',
                name: 'Test Thread',
                threadId: 'thread-123',
                updatedAt: '2023-01-01T00:00:00Z',
                userId: 'user-456',
            };

            await mockDataService.saveThread(threadData);

            const foundThread = await mockDataService.getThreadByUserId('user-456');
            expect(foundThread).toEqual(threadData);
        });
    });

    describe('saveSettings', () => {
        it('should save and return the provided config', async () => {
            const botConfig: BotSettings = {
                adminGroupId: '12345',
                configId: 'test-config',
                setupAt: '2023-01-01T00:00:00Z',
                setupBy: {
                    first_name: 'Test',
                    id: 67890,
                    is_bot: false,
                },
            };

            const savedConfig = await mockDataService.saveSettings(botConfig);

            expect(savedConfig).toEqual(botConfig);
            expect(mockDataService['botConfig']).toEqual(botConfig);
        });

        it('should overwrite previous config when saving a new one', async () => {
            const initialConfig: BotSettings = {
                adminGroupId: '12345',
                configId: 'initial-config',
                setupAt: '2023-01-01T00:00:00Z',
                setupBy: {
                    first_name: 'Test',
                    id: 67890,
                    is_bot: false,
                },
            };

            const updatedConfig: BotSettings = {
                adminGroupId: '98765',
                configId: 'updated-config',
                setupAt: '2023-01-02T00:00:00Z',
                setupBy: {
                    first_name: 'Updated Test',
                    id: 54321,
                    is_bot: false,
                },
            };

            await mockDataService.saveSettings(initialConfig);
            await mockDataService.saveSettings(updatedConfig);

            const config = await mockDataService.getSettings();
            expect(config).toEqual(updatedConfig);
        });
    });

    describe('saveMessage', () => {
        it('should add the message to the messages array and return it', async () => {
            const message: SavedMessage = {
                chatId: '100',
                from: {
                    firstName: 'User1',
                    userId: '123',
                },
                id: '1',
                text: 'Test message',
                timestamp: '2023-01-01T00:00:00Z',
                type: 'user',
            };

            const savedMessage = await mockDataService.saveMessage(message);

            expect(savedMessage).toEqual(message);
            expect(mockDataService['messages']).toContain(message);
        });

        it('should preserve all message properties when saving', async () => {
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
            };

            const savedMessage = await mockDataService.saveMessage(message);

            expect(savedMessage).toEqual(message);
        });
    });

    describe('saveThread', () => {
        it('should add the thread to the threads array and return it', async () => {
            const threadData: ThreadData = {
                chatId: 'chat-789',
                createdAt: '2023-01-01T00:00:00Z',
                lastMessageId: 'msg-001',
                name: 'Test Thread',
                threadId: 'thread-123',
                updatedAt: '2023-01-01T00:00:00Z',
                userId: 'user-456',
            };

            const savedThread = await mockDataService.saveThread(threadData);

            expect(savedThread).toEqual(threadData);
            expect(mockDataService['threads']).toContain(threadData);
        });

        it('should allow saving multiple threads', async () => {
            const thread1: ThreadData = {
                chatId: 'chat-789',
                createdAt: '2023-01-01T00:00:00Z',
                lastMessageId: 'msg-001',
                name: 'First Thread',
                threadId: 'thread-123',
                updatedAt: '2023-01-01T00:00:00Z',
                userId: 'user-456',
            };

            const thread2: ThreadData = {
                chatId: 'chat-123',
                createdAt: '2023-01-02T00:00:00Z',
                lastMessageId: 'msg-002',
                name: 'Second Thread',
                threadId: 'thread-456',
                updatedAt: '2023-01-02T00:00:00Z',
                userId: 'user-789',
            };

            await mockDataService.saveThread(thread1);
            await mockDataService.saveThread(thread2);

            expect(mockDataService['threads']).toContain(thread1);
            expect(mockDataService['threads']).toContain(thread2);
            expect(mockDataService['threads'].length).toBe(2);
        });
    });
});

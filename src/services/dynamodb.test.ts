import logger from '@/utils/logger.js';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BotConfig, SavedMessage, ThreadData } from '../types.js';

import { DynamoDBService } from './dynamodb.js';

vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: vi.fn().mockReturnValue({
            send: vi.fn(),
        }),
    },
    GetCommand: vi.fn(),
    PutCommand: vi.fn(),
    QueryCommand: vi.fn(),
}));

vi.mock('@/utils/logger.js', () => ({
    default: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
}));

vi.mock('../config.js', () => ({
    config: {
        TABLE_NAME: 'test-table',
    },
}));

describe('DynamoDBService', () => {
    let dynamoDBService: DynamoDBService;
    let mockClient: { send: any };

    beforeEach(() => {
        vi.clearAllMocks();

        mockClient = {
            send: vi.fn(),
        };
        (DynamoDBDocumentClient.from as any).mockReturnValue(mockClient);

        dynamoDBService = new DynamoDBService();
    });

    describe('getConfig', () => {
        it('should return the bot config when found', async () => {
            const mockConfig: BotConfig = {
                adminGroupId: 'admin-123',
                configId: 'config-123',
                setupAt: '2023-01-01T00:00:00Z',
                setupBy: { firstName: 'Admin', id: 123 },
            };

            mockClient.send.mockResolvedValueOnce({
                Item: mockConfig,
            });

            const result = await dynamoDBService.getConfig();

            expect(GetCommand).toHaveBeenCalledWith({
                Key: { userId: 'config' },
                TableName: 'test-table',
            });
            expect(result).toEqual(mockConfig);
        });

        it('should return null when config not found', async () => {
            mockClient.send.mockResolvedValueOnce({
                Item: null,
            });

            const result = await dynamoDBService.getConfig();

            expect(result).toBeNull();
        });

        it('should handle errors and return null', async () => {
            const error = new Error('DynamoDB error');
            mockClient.send.mockRejectedValueOnce(error);

            const result = await dynamoDBService.getConfig();

            expect(logger.error).toHaveBeenCalledTimes(1);
            expect(result).toBeNull();
        });
    });

    describe('getMessagesByUserId', () => {
        it('should return messages for a user', async () => {
            const userId = 'user123';
            const mockMessages = [
                { id: 'msg1', text: 'Hello', timestamp: '2023-01-01T00:00:00Z' },
                { id: 'msg2', text: 'World', timestamp: '2023-01-01T00:01:00Z' },
            ] as SavedMessage[];

            mockClient.send.mockResolvedValueOnce({
                Items: mockMessages,
            });

            const result = await dynamoDBService.getMessagesByUserId(userId);

            expect(QueryCommand).toHaveBeenCalledWith({
                ExpressionAttributeValues: {
                    ':userId': `${userId}#messages`,
                },
                KeyConditionExpression: 'userId = :userId',
                ScanIndexForward: false,
                TableName: 'test-table',
            });
            expect(result).toEqual(mockMessages);
        });

        it('should return empty array when no messages found', async () => {
            mockClient.send.mockResolvedValueOnce({
                Items: [],
            });

            const result = await dynamoDBService.getMessagesByUserId('user123');

            expect(result).toEqual([]);
        });

        it('should return empty array when items are not defined', async () => {
            mockClient.send.mockResolvedValueOnce({});

            const result = await dynamoDBService.getMessagesByUserId('user123');

            expect(result).toEqual([]);
        });

        it('should handle errors and return empty array', async () => {
            const error = new Error('DynamoDB error');
            mockClient.send.mockRejectedValueOnce(error);

            const result = await dynamoDBService.getMessagesByUserId('user123');

            expect(logger.error).toHaveBeenCalledTimes(1);
            expect(result).toEqual([]);
        });
    });

    describe('getThreadById', () => {
        it('should return thread when found', async () => {
            const threadId = 'thread123';
            const mockThread: ThreadData = {
                chatId: 'chat123',
                createdAt: '2023-01-01T00:00:00Z',
                lastMessageId: 'msg123',
                name: 'Test Thread',
                threadId: 123,
                updatedAt: '2023-01-01T00:01:00Z',
                userId: 'user123',
            };

            mockClient.send.mockResolvedValueOnce({
                Items: [mockThread],
            });

            const result = await dynamoDBService.getThreadById(threadId);

            expect(QueryCommand).toHaveBeenCalledWith({
                ExpressionAttributeValues: {
                    ':threadId': threadId,
                },
                IndexName: 'ThreadIdIndex',
                KeyConditionExpression: 'threadId = :threadId',
                TableName: 'test-table',
            });
            expect(result).toEqual(mockThread);
        });

        it('should return undefined when thread not found', async () => {
            mockClient.send.mockResolvedValueOnce({
                Items: [],
            });

            const result = await dynamoDBService.getThreadById('thread123');

            expect(result).toBeUndefined();
        });

        it('should handle errors and return undefined', async () => {
            const error = new Error('DynamoDB error');
            mockClient.send.mockRejectedValueOnce(error);

            const result = await dynamoDBService.getThreadById('thread123');

            expect(logger.error).toHaveBeenCalledTimes(1);
            expect(result).toBeUndefined();
        });
    });

    describe('getThreadByUserId', () => {
        it('should return thread when found', async () => {
            const userId = 'user123';
            const mockThread: ThreadData = {
                chatId: 'chat123',
                createdAt: '2023-01-01T00:00:00Z',
                lastMessageId: 'msg123',
                name: 'Test Thread',
                threadId: 123,
                updatedAt: '2023-01-01T00:01:00Z',
                userId: userId,
            };

            mockClient.send.mockResolvedValueOnce({
                Item: mockThread,
            });

            const result = await dynamoDBService.getThreadByUserId(userId);

            expect(GetCommand).toHaveBeenCalledWith({
                Key: { userId },
                TableName: 'test-table',
            });
            expect(result).toEqual(mockThread);
        });

        it('should return undefined when thread not found', async () => {
            mockClient.send.mockResolvedValueOnce({});

            const result = await dynamoDBService.getThreadByUserId('user123');

            expect(result).toBeUndefined();
        });

        it('should handle errors and return undefined', async () => {
            const error = new Error('DynamoDB error');
            mockClient.send.mockRejectedValueOnce(error);

            const result = await dynamoDBService.getThreadByUserId('user123');

            expect(logger.error).toHaveBeenCalledTimes(1);
            expect(result).toBeUndefined();
        });
    });

    describe('saveConfig', () => {
        it('should save the config and return it', async () => {
            const mockConfig: BotConfig = {
                adminGroupId: 'admin-123',
                configId: 'config-123',
                setupAt: '2023-01-01T00:00:00Z',
                setupBy: { first_name: 'Admin', id: 123, is_bot: false },
            };

            mockClient.send.mockResolvedValueOnce({});

            const result = await dynamoDBService.saveConfig(mockConfig);

            expect(PutCommand).toHaveBeenCalledWith({
                Item: {
                    userId: 'config',
                    ...mockConfig,
                },
                TableName: 'test-table',
            });
            expect(result).toEqual(mockConfig);
        });

        it('should throw error when save fails', async () => {
            const mockConfig: BotConfig = {
                adminGroupId: 'admin-123',
                configId: 'config-123',
                setupAt: '2023-01-01T00:00:00Z',
                setupBy: { first_name: 'Admin', id: 123, is_bot: false },
            };

            const error = new Error('DynamoDB error');
            mockClient.send.mockRejectedValueOnce(error);

            await expect(dynamoDBService.saveConfig(mockConfig)).rejects.toThrow(error);
            expect(logger.error).toHaveBeenCalledTimes(1);
        });
    });

    describe('saveMessage', () => {
        it('should save the message with modified userId and return original message', async () => {
            const mockMessage: SavedMessage = {
                chatId: 'chat123',
                from: {
                    firstName: 'John',
                    userId: 'user123',
                },
                id: 'msg123',
                text: 'Hello world',
                timestamp: '2023-01-01T00:00:00Z',
                type: 'user',
            };

            mockClient.send.mockResolvedValueOnce({});

            const result = await dynamoDBService.saveMessage(mockMessage);

            expect(PutCommand).toHaveBeenCalledWith({
                Item: {
                    ...mockMessage,
                    userId: 'user123#messages',
                },
                TableName: 'test-table',
            });
            expect(result).toEqual(mockMessage);
        });

        it('should throw error when save fails', async () => {
            const mockMessage: SavedMessage = {
                chatId: 'chat123',
                from: {
                    firstName: 'John',
                    userId: 'user123',
                },
                id: 'msg123',
                text: 'Hello world',
                timestamp: '2023-01-01T00:00:00Z',
                type: 'user',
            };

            const error = new Error('DynamoDB error');
            mockClient.send.mockRejectedValueOnce(error);

            await expect(dynamoDBService.saveMessage(mockMessage)).rejects.toThrow(error);
            expect(logger.error).toHaveBeenCalledTimes(1);
        });
    });

    describe('saveThread', () => {
        it('should save the thread and return it', async () => {
            const mockThread: ThreadData = {
                chatId: 'chat123',
                createdAt: '2023-01-01T00:00:00Z',
                lastMessageId: 'msg123',
                name: 'Test Thread',
                threadId: 123,
                updatedAt: '2023-01-01T00:01:00Z',
                userId: 'user123',
            };

            mockClient.send.mockResolvedValueOnce({});

            const result = await dynamoDBService.saveThread(mockThread);

            expect(PutCommand).toHaveBeenCalledWith({
                Item: mockThread,
                TableName: 'test-table',
            });
            expect(result).toEqual(mockThread);
        });

        it('should throw error when save fails', async () => {
            const mockThread: ThreadData = {
                chatId: 'chat123',
                createdAt: '2023-01-01T00:00:00Z',
                lastMessageId: 'msg123',
                name: 'Test Thread',
                threadId: 123,
                updatedAt: '2023-01-01T00:01:00Z',
                userId: 'user123',
            };

            const error = new Error('DynamoDB error');
            mockClient.send.mockRejectedValueOnce(error);

            await expect(dynamoDBService.saveThread(mockThread)).rejects.toThrow(error);
            expect(logger.error).toHaveBeenCalledTimes(1);
        });
    });
});

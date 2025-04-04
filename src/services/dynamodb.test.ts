import type { BotSettings, SavedMessage, ThreadData } from '@/types/app.js';

import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

    describe('getSettings', () => {
        it('should return the bot config when found', async () => {
            const mockConfig: BotSettings = {
                adminGroupId: 'admin-123',
                setupAt: '2023-01-01T00:00:00Z',
                setupBy: { first_name: 'Admin', id: 123, is_bot: false },
            };

            mockClient.send.mockResolvedValueOnce({
                Item: mockConfig,
            });

            const result = await dynamoDBService.getSettings();

            expect(GetCommand).toHaveBeenCalledWith({
                Key: { configId: 'main' },
                TableName: 'test-table-config',
            });
            expect(result).toEqual(mockConfig);
        });

        it('should return undefined when config not found', async () => {
            mockClient.send.mockResolvedValueOnce({});

            const result = await dynamoDBService.getSettings();

            expect(result).toBeUndefined();
        });

        it('should handle errors', async () => {
            const error = new Error('DynamoDB error');
            mockClient.send.mockRejectedValueOnce(error);

            await expect(dynamoDBService.getSettings()).rejects.toThrow(expect.any(Error));
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
                    ':userId': `${userId}`,
                },
                KeyConditionExpression: 'userId = :userId',
                ScanIndexForward: false,
                TableName: 'test-table-messages',
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

        it('should handle errors', async () => {
            mockClient.send.mockRejectedValueOnce(new Error('DynamoDB error'));
            await expect(dynamoDBService.getMessagesByUserId('user123')).rejects.toThrow(expect.any(Error));
        });
    });

    describe('getThreadById', () => {
        it('should return thread when found', async () => {
            const threadId = 'thread123';
            const mockThread: ThreadData = {
                createdAt: '2023-01-01T00:00:00Z',
                lastMessageId: 'msg123',
                name: 'Test Thread',
                threadId: '123',
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
                TableName: 'test-table-threads',
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

        it('should handle errors', async () => {
            const error = new Error('DynamoDB error');
            mockClient.send.mockRejectedValueOnce(error);

            await expect(dynamoDBService.getThreadById('thread123')).rejects.toThrow(expect.any(Error));
        });
    });

    describe('getThreadByUserId', () => {
        it('should return thread when found', async () => {
            const userId = 'user123';
            const mockThread: ThreadData = {
                createdAt: '2023-01-01T00:00:00Z',
                lastMessageId: 'msg123',
                name: 'Test Thread',
                threadId: '123',
                updatedAt: '2023-01-01T00:01:00Z',
                userId: userId,
            };

            mockClient.send.mockResolvedValueOnce({
                Items: [mockThread],
            });

            const result = await dynamoDBService.getThreadByUserId(userId);

            expect(QueryCommand).toHaveBeenCalledWith({
                ExpressionAttributeValues: {
                    ':userId': 'user123',
                },
                IndexName: 'UserUpdatedIndex',
                KeyConditionExpression: 'userId = :userId',
                Limit: 1,
                ScanIndexForward: false,
                TableName: 'test-table-threads',
            });
            expect(result).toEqual(mockThread);
        });

        it('should return undefined when thread not found', async () => {
            mockClient.send.mockResolvedValueOnce({});

            const result = await dynamoDBService.getThreadByUserId('user123');

            expect(result).toBeUndefined();
        });

        it('should handle errors', async () => {
            const error = new Error('DynamoDB error');
            mockClient.send.mockRejectedValueOnce(error);

            await expect(dynamoDBService.getThreadByUserId('user123')).rejects.toThrow(expect.any(Error));
        });
    });

    describe('saveSettings', () => {
        it('should save the config and return it', async () => {
            const mockConfig: BotSettings = {
                adminGroupId: 'admin-123',
                setupAt: '2023-01-01T00:00:00Z',
                setupBy: { first_name: 'Admin', id: 123, is_bot: false },
            };

            mockClient.send.mockResolvedValueOnce({});

            const result = await dynamoDBService.saveSettings(mockConfig);

            expect(PutCommand).toHaveBeenCalledWith({
                Item: {
                    configId: 'main',
                    ...mockConfig,
                },
                TableName: 'test-table-config',
            });
            expect(result).toEqual(mockConfig);
        });

        it('should throw error when save fails', async () => {
            const mockConfig: BotSettings = {
                adminGroupId: 'admin-123',
                setupAt: '2023-01-01T00:00:00Z',
                setupBy: { first_name: 'Admin', id: 123, is_bot: false },
            };

            const error = new Error('DynamoDB error');
            mockClient.send.mockRejectedValueOnce(error);

            await expect(dynamoDBService.saveSettings(mockConfig)).rejects.toThrow(error);
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
                    messageId: 'msg123',
                    userId: 'user123',
                },
                TableName: 'test-table-messages',
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
        });
    });

    describe('saveThread', () => {
        it('should save the thread and return it', async () => {
            const mockThread: ThreadData = {
                createdAt: '2023-01-01T00:00:00Z',
                lastMessageId: 'msg123',
                name: 'Test Thread',
                threadId: '123',
                updatedAt: '2023-01-01T00:01:00Z',
                userId: 'user123',
            };

            mockClient.send.mockResolvedValueOnce({});

            const result = await dynamoDBService.saveThread(mockThread);

            expect(PutCommand).toHaveBeenCalledWith({
                Item: mockThread,
                TableName: 'test-table-threads',
            });
            expect(result).toEqual(mockThread);
        });

        it('should throw error when save fails', async () => {
            const error = new Error('DynamoDB error');
            mockClient.send.mockRejectedValueOnce(error);

            await expect(
                dynamoDBService.saveThread({
                    createdAt: '2023-01-01T00:00:00Z',
                    lastMessageId: 'msg123',
                    name: 'Test Thread',
                    threadId: '123',
                    updatedAt: '2023-01-01T00:01:00Z',
                    userId: 'user123',
                }),
            ).rejects.toThrow(error);
        });
    });
});

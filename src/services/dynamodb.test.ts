import type { BotSettings, SavedMessage, ThreadData } from '@/types/app.js';

import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DynamoDBService } from './dynamodb.js';

vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: vi.fn(function DynamoDBClientMock() {
        return {};
    }),
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
    const BOT_USERNAME = 'testbot';
    let service: DynamoDBService;
    let mockClient: { send: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        vi.clearAllMocks();

        mockClient = { send: vi.fn() };
        (DynamoDBDocumentClient.from as any).mockReturnValue(mockClient);

        service = new DynamoDBService(BOT_USERNAME);
    });

    describe('getSettings', () => {
        it('retrieves bot settings using a prefixed config key', async () => {
            const storedItem = {
                adminGroupId: 'admin-123',
                botUsername: BOT_USERNAME,
                configId: `${BOT_USERNAME}#main`,
                setupAt: '2023-01-01T00:00:00Z',
                setupBy: { first_name: 'Admin', id: 123, is_bot: false },
            } satisfies Record<string, unknown>;

            mockClient.send.mockResolvedValueOnce({ Item: storedItem });

            const result = await service.getSettings();

            expect(GetCommand).toHaveBeenCalledWith({
                Key: { configId: `${BOT_USERNAME}#main` },
                TableName: 'test-table-config',
            });
            expect(result).toEqual({
                adminGroupId: 'admin-123',
                botUsername: BOT_USERNAME,
                setupAt: '2023-01-01T00:00:00Z',
                setupBy: { first_name: 'Admin', id: 123, is_bot: false },
            } satisfies BotSettings);
        });
    });

    describe('getMessagesByUserId', () => {
        it('queries messages using the prefixed user id and maps results', async () => {
            const storedMessages = [
                {
                    botUsername: BOT_USERNAME,
                    id: 'msg1',
                    messageId: 'msg1',
                    text: 'Hello',
                    timestamp: '2023-01-01T00:00:00Z',
                    type: 'user',
                    userId: `${BOT_USERNAME}#user123`,
                    from: { userId: 'user123' },
                },
            ];

            mockClient.send.mockResolvedValueOnce({ Items: storedMessages });

            const result = await service.getMessagesByUserId('user123');

            expect(QueryCommand).toHaveBeenCalledWith({
                ExpressionAttributeValues: { ':userId': `${BOT_USERNAME}#user123` },
                KeyConditionExpression: 'userId = :userId',
                ScanIndexForward: false,
                TableName: 'test-table-messages',
            });

            expect(result).toEqual([
                expect.objectContaining({
                    botUsername: BOT_USERNAME,
                    id: 'msg1',
                    type: 'user',
                }) satisfies Partial<SavedMessage>,
            ]);
        });
    });

    describe('getThreadById', () => {
        it('queries using the prefixed thread id and strips it from the response', async () => {
            const storedThread = {
                actualThreadId: '123',
                actualUserId: 'user123',
                botUsername: BOT_USERNAME,
                createdAt: '2023-01-01T00:00:00Z',
                lastMessageId: '999',
                name: 'Support',
                threadId: `${BOT_USERNAME}#123`,
                updatedAt: '2023-01-02T00:00:00Z',
                userId: `${BOT_USERNAME}#user123`,
            } satisfies Record<string, unknown>;

            mockClient.send.mockResolvedValueOnce({ Items: [storedThread] });

            const thread = await service.getThreadById('123');

            expect(QueryCommand).toHaveBeenCalledWith({
                ExpressionAttributeValues: { ':threadId': `${BOT_USERNAME}#123` },
                IndexName: 'ThreadIdIndex',
                KeyConditionExpression: 'threadId = :threadId',
                TableName: 'test-table-threads',
            });

            expect(thread).toEqual({
                botUsername: BOT_USERNAME,
                createdAt: '2023-01-01T00:00:00Z',
                lastMessageId: '999',
                name: 'Support',
                threadId: '123',
                updatedAt: '2023-01-02T00:00:00Z',
                userId: 'user123',
            } satisfies ThreadData);
        });
    });

    describe('getThreadByUserId', () => {
        it('queries using the prefixed user id', async () => {
            const storedThread = {
                actualThreadId: '123',
                actualUserId: 'user123',
                botUsername: BOT_USERNAME,
                createdAt: '2023-01-01T00:00:00Z',
                lastMessageId: '999',
                name: 'Support',
                threadId: `${BOT_USERNAME}#123`,
                updatedAt: '2023-01-02T00:00:00Z',
                userId: `${BOT_USERNAME}#user123`,
            };

            mockClient.send.mockResolvedValueOnce({ Items: [storedThread] });

            const thread = await service.getThreadByUserId('user123');

            expect(QueryCommand).toHaveBeenCalledWith({
                ExpressionAttributeValues: { ':userId': `${BOT_USERNAME}#user123` },
                IndexName: 'UserUpdatedIndex',
                KeyConditionExpression: 'userId = :userId',
                Limit: 1,
                ScanIndexForward: false,
                TableName: 'test-table-threads',
            });

            expect(thread).toEqual({
                botUsername: BOT_USERNAME,
                createdAt: '2023-01-01T00:00:00Z',
                lastMessageId: '999',
                name: 'Support',
                threadId: '123',
                updatedAt: '2023-01-02T00:00:00Z',
                userId: 'user123',
            } satisfies ThreadData);
        });
    });

    describe('saveMessage', () => {
        it('persists the message with prefixed identifiers', async () => {
            const message: SavedMessage = {
                botUsername: BOT_USERNAME,
                chatId: 'chat-1',
                from: { userId: 'user123' },
                id: 'msg1',
                text: 'Hi',
                timestamp: '2023-01-01T00:00:00Z',
                type: 'user',
            };

            await service.saveMessage(message);

            expect(PutCommand).toHaveBeenCalledWith({
                Item: expect.objectContaining({
                    botUsername: BOT_USERNAME,
                    messageId: 'msg1',
                    userId: `${BOT_USERNAME}#user123`,
                }),
                TableName: 'test-table-messages',
            });
        });
    });

    describe('saveSettings', () => {
        it('stores settings with a prefixed config id', async () => {
            const settings: BotSettings = {
                adminGroupId: 'admin-123',
                botUsername: BOT_USERNAME,
                setupAt: '2023-01-01T00:00:00Z',
                setupBy: { first_name: 'Admin', id: 123, is_bot: false },
            };

            await service.saveSettings(settings);

            expect(PutCommand).toHaveBeenCalledWith({
                Item: expect.objectContaining({
                    botUsername: BOT_USERNAME,
                    configId: `${BOT_USERNAME}#main`,
                }),
                TableName: 'test-table-config',
            });
        });
    });

    describe('saveThread', () => {
        it('stores thread with prefixed identifiers', async () => {
            const thread: ThreadData = {
                botUsername: BOT_USERNAME,
                createdAt: '2023-01-01T00:00:00Z',
                lastMessageId: '999',
                name: 'Support',
                threadId: '123',
                updatedAt: '2023-01-02T00:00:00Z',
                userId: 'user123',
            };

            await service.saveThread(thread);

            expect(PutCommand).toHaveBeenCalledWith({
                Item: expect.objectContaining({
                    botUsername: BOT_USERNAME,
                    threadId: `${BOT_USERNAME}#123`,
                    userId: `${BOT_USERNAME}#user123`,
                }),
                TableName: 'test-table-threads',
            });
        });
    });
});

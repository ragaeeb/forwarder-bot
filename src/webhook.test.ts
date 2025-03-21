import { APIGatewayProxyEvent } from 'aws-lambda';
import { Bot } from 'gramio';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { registerHandlers } from './handlers/index.js';
import { DynamoDBService } from './services/dynamodb.js';
import { handler } from './webhook.js';

vi.mock('gramio', () => ({
    Bot: vi.fn().mockImplementation(() => ({
        init: vi.fn(),
        stop: vi.fn(),
        updates: {
            handleUpdate: vi.fn().mockResolvedValue(undefined),
        },
    })),
}));

vi.mock('./config.js', () => ({
    config: {
        BOT_TOKEN: 'test-token',
        SECRET_TOKEN: 'test-secret-token', // Add the SECRET_TOKEN
    },
}));

vi.mock('./handlers/index.js', () => ({
    registerHandlers: vi.fn(),
}));

vi.mock('./services/dynamodb.js', () => ({
    DynamoDBService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@/utils/logger.js', () => ({
    default: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(), // Add warn for secret token logging
    },
}));

describe('webhook', () => {
    let mockEvent: APIGatewayProxyEvent;

    beforeEach(() => {
        vi.clearAllMocks();

        mockEvent = {
            body: JSON.stringify({
                message: {
                    chat: { id: 12345, type: 'private' },
                    date: 1645564800,
                    message_id: 123,
                    text: 'Hello, bot!',
                },
                update_id: 123456789,
            }),
            headers: {
                'x-telegram-bot-api-secret-token': 'test-secret-token', // Add the secret token header
            },
            httpMethod: 'POST',
            isBase64Encoded: false,
            multiValueHeaders: {},
            multiValueQueryStringParameters: null,
            path: '/webhook',
            pathParameters: null,
            queryStringParameters: null,
            requestContext: {} as APIGatewayProxyEvent['requestContext'],
            resource: '',
            stageVariables: null,
        };
    });

    describe('handler', () => {
        it('should successfully process a webhook event with valid secret token', async () => {
            const result = await handler(mockEvent);

            expect(Bot).toHaveBeenCalledWith('test-token');
            expect(DynamoDBService).toHaveBeenCalled();
            expect(registerHandlers).toHaveBeenCalled();

            const botInstance = (Bot as any).mock.results[0].value;
            expect(botInstance.updates.handleUpdate).toHaveBeenCalledWith({
                message: {
                    chat: { id: 12345, type: 'private' },
                    date: 1645564800,
                    message_id: 123,
                    text: 'Hello, bot!',
                },
                update_id: 123456789,
            });

            expect(result).toEqual({
                body: JSON.stringify({ ok: true }),
                statusCode: 200,
            });
        });

        it('should handle uncaught exceptions', async () => {
            const processSpy = vi.spyOn(process, 'on');

            await handler(mockEvent);

            expect(processSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));

            const [, uncaughtHandler = () => {}] =
                processSpy.mock.calls.find((call) => call[0] === 'uncaughtException') || [];
            const mockError = new Error('Uncaught test error');
            uncaughtHandler(mockError);

            const { default: logger } = await import('@/utils/logger.js');
            expect(logger.error).toHaveBeenCalledWith(mockError, 'Uncaught Exception:');
            expect(logger.error).toHaveBeenCalledWith(mockError.stack, 'Stack trace:');

            processSpy.mockRestore();
        });

        it('should use mock database if provided', async () => {
            const mockDb = { test: 'mock db' };
            const { setMockDatabase } = await import('./webhook.js');

            setMockDatabase(mockDb as any);
            await handler(mockEvent);

            expect(DynamoDBService).not.toHaveBeenCalled();
        });

        it.each([
            { scenario: 'invalid token', token: 'invalid-token' },
            { scenario: 'missing token', token: undefined },
        ])('should reject requests with $scenario', async ({ token }) => {
            mockEvent.headers['x-telegram-bot-api-secret-token'] = token;

            const result = await handler(mockEvent);

            expect(Bot).not.toHaveBeenCalled();
            expect(DynamoDBService).not.toHaveBeenCalled();
            expect(registerHandlers).not.toHaveBeenCalled();

            expect(result).toEqual({
                body: JSON.stringify({ error: 'Unauthorized', ok: false }),
                statusCode: 403,
            });
        });

        it('should handle missing body properly', async () => {
            mockEvent.body = null;

            const result = await handler(mockEvent);

            expect(result).toEqual({
                body: expect.any(String),
                statusCode: 200,
            });

            const responseBody = JSON.parse(result.body);
            expect(responseBody.ok).toBe(true);
            expect(responseBody.error).toBeUndefined();
        });

        it('should handle invalid JSON in body', async () => {
            mockEvent.body = '{ invalid json';

            const result = await handler(mockEvent);

            expect(result.statusCode).toBe(200);
            expect(JSON.parse(result.body).ok).toBe(false);
        });

        it('should handle bot.updates.handleUpdate throwing an error', async () => {
            const mockError = new Error('Bot update handling failed');
            const mockBot = {
                init: vi.fn(),
                stop: vi.fn(),
                updates: {
                    handleUpdate: vi.fn().mockRejectedValue(mockError),
                },
            };
            (Bot as any).mockImplementation(() => mockBot);

            const result = await handler(mockEvent);

            expect(result).toEqual({
                body: expect.stringContaining('Bot update handling failed'),
                statusCode: 200,
            });
            expect(JSON.parse(result.body).ok).toBe(false);
            expect(mockBot.stop).toHaveBeenCalledExactlyOnceWith();
        });
    });

    describe('initWebhook', () => {
        it('should initialize webhook correctly', async () => {
            const { initWebhook } = await import('./webhook.js');
            const mockSetWebhook = vi.fn().mockResolvedValue(true);
            (Bot as any).mockImplementation(() => ({
                api: {
                    setWebhook: mockSetWebhook,
                },
            }));

            await initWebhook('https://example.com/api');

            expect(Bot).toHaveBeenCalledWith('test-token');
            expect(mockSetWebhook).toHaveBeenCalledWith({
                drop_pending_updates: true,
                secret_token: 'test-secret-token',
                url: 'https://example.com/api/test-token',
            });
        });
    });

    describe('resetHook', () => {
        it('should reset webhook correctly', async () => {
            const { resetHook } = await import('./webhook.js');
            const mockDeleteWebhook = vi.fn().mockResolvedValue(true);
            (Bot as any).mockImplementation(() => ({
                api: {
                    deleteWebhook: mockDeleteWebhook,
                },
            }));

            await resetHook();

            expect(Bot).toHaveBeenCalledWith('test-token');
            expect(mockDeleteWebhook).toHaveBeenCalledWith({
                drop_pending_updates: true,
            });
        });
    });
});

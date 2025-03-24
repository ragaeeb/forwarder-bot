import { APIGatewayProxyEvent } from 'aws-lambda';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';

import { Bot } from './bot.js';
import { registerHandlers } from './handlers/index.js';
import { DynamoDBService } from './services/dynamodb.js';
import { TelegramAPI } from './services/telegramAPI.js';

vi.mock('./bot.js', () => ({
    Bot: vi.fn().mockImplementation(() => ({
        handleUpdate: vi.fn().mockResolvedValue(undefined),
        init: vi.fn().mockResolvedValue({ username: 'test_bot' }),
    })),
}));

vi.mock('./handlers/index.js', () => ({
    registerHandlers: vi.fn(),
}));

vi.mock('./services/dynamodb.js', () => ({
    DynamoDBService: vi.fn().mockImplementation(() => ({
        getSettings: vi.fn().mockResolvedValue(null),
    })),
}));

vi.mock('./services/telegramAPI.js', () => ({
    TelegramAPI: vi.fn().mockImplementation(() => ({
        deleteWebhook: vi.fn().mockResolvedValue(true),
        setWebhook: vi.fn().mockResolvedValue(true),
    })),
}));

describe('webhook', () => {
    let mockEvent: APIGatewayProxyEvent;
    let processOnSpy: any;

    const originalProcessOn = process.on;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();

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
                'x-telegram-bot-api-secret-token': 'test-secret-token',
            },
            httpMethod: 'POST',
            isBase64Encoded: false,
            multiValueHeaders: {},
            multiValueQueryStringParameters: null,
            path: '/webhook',
            pathParameters: null,
            queryStringParameters: null,
            requestContext: {} as any,
            resource: '',
            stageVariables: null,
        };

        processOnSpy = vi.fn();
        process.on = processOnSpy;
    });

    afterEach(() => {
        process.on = originalProcessOn;
    });

    describe('handler', () => {
        it('should initialize the bot on first call', async () => {
            const { handler } = await import('./webhook.js');

            const result = await handler(mockEvent);

            expect(Bot).toHaveBeenCalledWith('BT');
            expect(DynamoDBService).toHaveBeenCalled();
            expect(registerHandlers).toHaveBeenCalled();

            const botInstance = (Bot as any).mock.results[0].value;
            expect(botInstance.handleUpdate).toHaveBeenCalled();

            expect(result).toEqual({
                body: JSON.stringify({ ok: true }),
                statusCode: 200,
            });
        });

        it('should use existing bot instance on subsequent calls', async () => {
            const { handler } = await import('./webhook.js');

            await handler(mockEvent);
            await handler(mockEvent);

            expect(Bot).toHaveBeenCalledExactlyOnceWith('BT');
            expect(DynamoDBService).toHaveBeenCalledOnce();
            expect(registerHandlers).toHaveBeenCalledOnce();

            const botInstance = (Bot as any).mock.results[0].value;
            expect(botInstance.handleUpdate).toHaveBeenCalled();
        });

        it('should handle uncaught exceptions', async () => {
            const { handler } = await import('./webhook.js');
            await handler(mockEvent);

            expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));

            const [, uncaughtHandler] =
                processOnSpy.mock.calls.find((call: any) => call[0] === 'uncaughtException') || [];

            const mockError = new Error('Uncaught test error');
            uncaughtHandler(mockError);
        });

        it('should use mock database if provided', async () => {
            const { handler, setMockDatabase } = await import('./webhook.js');
            const mockDb = { test: 'mock db' };
            setMockDatabase(mockDb as any);

            await handler(mockEvent);

            expect(DynamoDBService).not.toHaveBeenCalled();
            expect(registerHandlers).toHaveBeenCalledWith(expect.anything(), mockDb);
        });

        it('should reject requests with invalid token', async () => {
            mockEvent.headers['x-telegram-bot-api-secret-token'] = 'invalid-token';

            const { handler } = await import('./webhook.js');

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

            const { handler } = await import('./webhook.js');
            const result = await handler(mockEvent);

            expect(result).toEqual({
                body: JSON.stringify({ ok: true }),
                statusCode: 200,
            });
        });

        it('should handle errors', async () => {
            (registerHandlers as Mock).mockImplementation(() => {
                throw new Error('Test error');
            });

            const { handler } = await import('./webhook.js');
            const result = await handler(mockEvent);

            expect(result).toEqual({
                body: JSON.stringify({ error: 'Test error', ok: false }),
                statusCode: 200,
            });
        });
    });

    describe('initWebhook', () => {
        it('should initialize webhook correctly', async () => {
            const { initWebhook } = await import('./webhook.js');
            await initWebhook('https://example.com/api');

            expect(TelegramAPI).toHaveBeenCalledWith('BT');

            const telegramApiInstance = (TelegramAPI as any).mock.results[0].value;
            expect(telegramApiInstance.setWebhook).toHaveBeenCalledWith({
                drop_pending_updates: true,
                secret_token: 'test-secret-token',
                url: 'https://example.com/api/BT',
            });
        });
    });

    describe('resetHook', () => {
        it('should reset webhook correctly', async () => {
            const { resetHook } = await import('./webhook.js');
            await resetHook();

            expect(TelegramAPI).toHaveBeenCalledWith('BT');

            const telegramApiInstance = (TelegramAPI as any).mock.results[0].value;
            expect(telegramApiInstance.deleteWebhook).toHaveBeenCalledWith({
                drop_pending_updates: true,
            });
        });
    });
});

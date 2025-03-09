import { APIGatewayProxyEvent } from 'aws-lambda';
import { Bot } from 'gramio';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { registerHandlers } from './handlers/index.js';
import { DynamoDBService } from './services/dynamodb.js';
import logger from './utils/logger.js';
import { handler } from './webhook.js';

vi.mock('gramio', () => ({
    Bot: vi.fn().mockImplementation(() => ({
        updates: {
            handleUpdate: vi.fn().mockResolvedValue(undefined),
        },
    })),
}));

vi.mock('./config.js', () => ({
    config: {
        BOT_TOKEN: 'test-token',
    },
}));

vi.mock('./handlers/index.js', () => ({
    registerHandlers: vi.fn(),
}));

vi.mock('./services/dynamodb.js', () => ({
    DynamoDBService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('./utils/logger.js', () => ({
    default: {
        error: vi.fn(),
        info: vi.fn(),
    },
}));

describe('webhook handler', () => {
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
            headers: {},
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
    });

    it('should successfully process a webhook event', async () => {
        const result = await handler(mockEvent);

        expect(logger.info).toHaveBeenCalledWith(`Webhook called: method=POST, path=/webhook`);
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

    it('should handle missing body properly', async () => {
        mockEvent.body = null;

        const result = await handler(mockEvent);

        expect(logger.error).toHaveBeenCalled();
        expect(result).toEqual({
            body: expect.any(String),
            statusCode: 200,
        });

        const responseBody = JSON.parse(result.body);
        expect(responseBody.ok).toBe(false);
        expect(responseBody.error).toBeDefined();
    });

    it('should handle invalid JSON in body', async () => {
        mockEvent.body = '{ invalid json';

        const result = await handler(mockEvent);

        expect(logger.error).toHaveBeenCalled();
        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body).ok).toBe(false);
    });

    it('should handle bot.updates.handleUpdate throwing an error', async () => {
        const mockError = new Error('Bot update handling failed');
        const mockBot = {
            updates: {
                handleUpdate: vi.fn().mockRejectedValue(mockError),
            },
        };
        (Bot as any).mockImplementation(() => mockBot);

        const result = await handler(mockEvent);

        expect(logger.error).toHaveBeenCalled();
        expect(result).toEqual({
            body: expect.stringContaining('Bot update handling failed'),
            statusCode: 200,
        });
        expect(JSON.parse(result.body).ok).toBe(false);
    });
});

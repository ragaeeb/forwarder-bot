import type { APIGatewayProxyEvent } from 'aws-lambda';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerHandlers } from './handlers/index.js';
import { TelegramAPI } from './services/telegramAPI.js';
import { handler, initWebhook, processWebhookUpdate, resetHook, setMockDatabase } from './webhook.js';

vi.mock('./bot.js', () => {
    const handleUpdate = vi.fn().mockResolvedValue(undefined);
    const getMe = vi.fn().mockResolvedValue({ username: 'testbot' });

    const BotMock = vi.fn().mockImplementation((token: string) => ({
        api: {
            getMe,
        },
        handleUpdate,
        token,
        username: undefined as string | undefined,
    }));

    return {
        Bot: BotMock,
        __esModule: true,
    };
});

vi.mock('./handlers/index.js', () => ({
    registerHandlers: vi.fn(),
}));

vi.mock('./services/telegramAPI.js', () => ({
    TelegramAPI: vi.fn().mockImplementation(() => ({
        deleteWebhook: vi.fn().mockResolvedValue(true),
        setWebhook: vi.fn().mockResolvedValue(true),
    })),
}));

describe('webhook', () => {
    const createEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent => ({
        body: JSON.stringify({ update_id: 1 }),
        headers: { 'x-telegram-bot-api-secret-token': 'test-secret-token' },
        httpMethod: 'POST',
        isBase64Encoded: false,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        path: '/BT',
        pathParameters: { token: 'BT' },
        queryStringParameters: null,
        requestContext: {} as any,
        resource: '',
        stageVariables: null,
        ...overrides,
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        setMockDatabase();
    });

    describe('processWebhookUpdate and handler', () => {
        it('initializes the bot and processes updates', async () => {
            const result = await handler(createEvent());

            const { Bot } = await import('./bot.js');
            const botInstance = (Bot as any).mock.results[0].value;

            expect(Bot).toHaveBeenCalledWith('BT');
            expect(registerHandlers).toHaveBeenCalledWith(botInstance, expect.any(Object));
            expect(botInstance.handleUpdate).toHaveBeenCalledWith({ update_id: 1 });
            expect(result).toEqual({ body: JSON.stringify({ ok: true }), statusCode: 200 });
        });

        it('returns 403 when the secret token does not match', async () => {
            const response = await handler(
                createEvent({ headers: { 'x-telegram-bot-api-secret-token': 'invalid-secret' } }),
            );

            expect(response).toEqual({
                body: JSON.stringify({ error: 'Unauthorized', ok: false }),
                statusCode: 403,
            });
        });

        it('reuses the bot instance on subsequent calls', async () => {
            await handler(createEvent());
            await handler(createEvent());

            const { Bot } = await import('./bot.js');
            expect(Bot).toHaveBeenCalledTimes(1);
        });

        it('allows overriding the data service with setMockDatabase', async () => {
            const mockDb = { botUsername: 'testbot', getSettings: vi.fn().mockResolvedValue(undefined) } as any;
            setMockDatabase(() => mockDb);

            await processWebhookUpdate({
                body: JSON.stringify({ update_id: 42 }),
                headers: { 'x-telegram-bot-api-secret-token': 'test-secret-token' },
                token: 'BT',
            });

            expect(registerHandlers).toHaveBeenLastCalledWith(expect.any(Object), mockDb);
        });
    });

    describe('initWebhook', () => {
        it('registers the webhook using the configured bot token and secret', async () => {
            await initWebhook('https://example.com/api');

            expect(TelegramAPI).toHaveBeenCalledWith('BT');
            const apiInstance = (TelegramAPI as any).mock.results[0].value;
            expect(apiInstance.setWebhook).toHaveBeenCalledWith({
                drop_pending_updates: true,
                secret_token: 'test-secret-token',
                url: 'https://example.com/api/BT',
            });
        });
    });

    describe('resetHook', () => {
        it('removes the webhook using the configured bot token', async () => {
            await resetHook();

            expect(TelegramAPI).toHaveBeenCalledWith('BT');
            const apiInstance = (TelegramAPI as any).mock.results[0].value;
            expect(apiInstance.deleteWebhook).toHaveBeenCalledWith({ drop_pending_updates: true });
        });
    });

    describe('vercel handler', () => {
        it('forwards the request to processWebhookUpdate and responds with its result', async () => {
            const { default: vercelHandler, config: vercelConfig } = await import('../api/telegram/[token].ts');
            const processWebhookUpdateSpy = vi
                .spyOn(await import('./webhook.js'), 'processWebhookUpdate')
                .mockResolvedValue({ body: JSON.stringify({ ok: true }), statusCode: 200 });

            expect(vercelConfig).toEqual({ api: { bodyParser: false } });

            const req = {
                body: JSON.stringify({ update_id: 99 }),
                headers: { 'x-telegram-bot-api-secret-token': 'secret' },
                query: { token: 'BT' },
            } as any;
            const res = {
                send: vi.fn().mockReturnThis(),
                setHeader: vi.fn(),
                status: vi.fn().mockReturnThis(),
            } as any;

            await vercelHandler(req, res);

            expect(processWebhookUpdateSpy).toHaveBeenCalledWith({
                body: JSON.stringify({ update_id: 99 }),
                headers: { 'x-telegram-bot-api-secret-token': 'secret' },
                token: 'BT',
            });
            expect(res.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith(JSON.stringify({ ok: true }));

            processWebhookUpdateSpy.mockRestore();
        });

        it('returns a 500 error when processWebhookUpdate throws', async () => {
            const { default: vercelHandler } = await import('../api/telegram/[token].ts');
            const spy = vi
                .spyOn(await import('./webhook.js'), 'processWebhookUpdate')
                .mockRejectedValueOnce(new Error('fail'));

            const req = {
                headers: {},
                on: vi.fn().mockImplementation(function (event: string, handler: (...args: any[]) => void) {
                    if (event === 'end') {
                        handler();
                    }
                    return this;
                }),
                query: { token: 'BT' },
            } as any;
            const res = {
                send: vi.fn().mockReturnThis(),
                setHeader: vi.fn(),
                status: vi.fn().mockReturnThis(),
            } as any;

            await vercelHandler(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.send).toHaveBeenCalledWith(JSON.stringify({ error: 'fail', ok: false }));

            spy.mockRestore();
        });
    });
});

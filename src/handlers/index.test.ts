import { onSetup } from '@/commands/setup.js';
import { onStart } from '@/commands/start.js';
import { DynamoDBService } from '@/services/dynamodb.js';
import { describe, expect, it, vi } from 'vitest';

import { onGenericMessage } from './genericMessage.js';
import { registerHandlers } from './index.js';

vi.mock('@/commands/start.js', () => ({
    onStart: vi.fn(),
}));

vi.mock('@/commands/setup.js', () => ({
    onSetup: vi.fn(),
}));

vi.mock('./genericMessage.js', () => ({
    onGenericMessage: vi.fn(),
}));

describe('registerHandlers', () => {
    it('should register all middleware and handlers correctly', () => {
        const mockBot = {
            command: vi.fn(),
            on: vi.fn(),
            use: vi.fn(),
        };

        const mockDB = {} as DynamoDBService;

        registerHandlers(mockBot as any, mockDB);

        expect(mockBot.use).toHaveBeenCalledTimes(2);
        expect(mockBot.command).toHaveBeenCalledTimes(2);
        expect(mockBot.on).toHaveBeenCalledTimes(1);

        expect(mockBot.command).toHaveBeenCalledWith('start', onStart);
        expect(mockBot.command).toHaveBeenCalledWith('setup', onSetup);
        expect(mockBot.on).toHaveBeenCalledWith('message', onGenericMessage);
    });
});

describe('middleware functions', () => {
    it('withBot middleware should call next() if the message is not from the bot', async () => {
        const mockBot = {
            command: vi.fn(),
            on: vi.fn(),
            use: vi.fn((middleware) => {
                middlewares.push(middleware);
            }),
        };

        const middlewares: Array<any> = [];
        const mockDB = {} as DynamoDBService;

        registerHandlers(mockBot as any, mockDB);

        const withBotMiddleware = middlewares[0];

        const mockCtx = {
            api: {
                getMe: vi.fn().mockResolvedValue({ first_name: 'Bot', id: 123 }),
            },
            from: {
                id: 456,
            },
        };

        const mockNext = vi.fn().mockResolvedValue(undefined);

        await withBotMiddleware(mockCtx, mockNext);

        expect(mockCtx.me).toEqual({ first_name: 'Bot', id: 123 });
        expect(mockNext).toHaveBeenCalled();
    });

    it('withBot middleware should not call next() if the message is from the bot', async () => {
        const mockBot = {
            command: vi.fn(),
            on: vi.fn(),
            use: vi.fn((middleware) => {
                middlewares.push(middleware);
            }),
        };

        const middlewares: Array<any> = [];
        const mockDB = {} as DynamoDBService;

        registerHandlers(mockBot as any, mockDB);

        const withBotMiddleware = middlewares[0];

        const mockCtx = {
            api: {
                getMe: vi.fn().mockResolvedValue({ first_name: 'Bot', id: 123 }),
            },
            from: {
                id: 123,
            },
            me: undefined,
        };

        const mockNext = vi.fn().mockResolvedValue(undefined);

        await withBotMiddleware(mockCtx, mockNext);

        expect(mockCtx.me).toEqual({ first_name: 'Bot', id: 123 });
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('withDB middleware should add db to context and call next()', async () => {
        const mockBot = {
            command: vi.fn(),
            on: vi.fn(),
            use: vi.fn((middleware) => {
                middlewares.push(middleware);
            }),
        };

        const middlewares: Array<any> = [];
        const mockDB = { test: 'db instance' } as any;

        registerHandlers(mockBot as any, mockDB);

        const withDBMiddleware = middlewares[1];

        const mockCtx = {};
        const mockNext = vi.fn().mockResolvedValue(undefined);

        await withDBMiddleware(mockCtx, mockNext);

        expect(mockCtx).toHaveProperty('db', mockDB);
        expect(mockNext).toHaveBeenCalled();
    });
});

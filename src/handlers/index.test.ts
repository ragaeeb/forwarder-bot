import type { DynamoDBService } from '@/services/dynamodb.js';
import type { Bot } from 'gramio';

import { onSetup } from '@/commands/setup.js';
import { onStart } from '@/commands/start.js';
import { describe, expect, it, vi } from 'vitest';

import { onGenericMessage } from './genericMessage.js';
import { handleEditedMessage } from './handleEditedMessage.js';
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

vi.mock('./handleEditedMessage.js', () => ({
    handleEditedMessage: vi.fn(),
}));

vi.mock('@/utils/logger.js', () => ({
    default: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
}));

describe('registerHandlers', () => {
    it('should register all middleware and handlers correctly', () => {
        const mockBot = {
            command: vi.fn(),
            on: vi.fn(),
            use: vi.fn(),
        };

        const mockDB: Partial<DynamoDBService> = {};

        registerHandlers(mockBot as unknown as Bot, mockDB as DynamoDBService);

        expect(mockBot.use).toHaveBeenCalledTimes(3);
        expect(mockBot.command).toHaveBeenCalledTimes(2);
        expect(mockBot.on).toHaveBeenCalledTimes(2);

        expect(mockBot.command).toHaveBeenCalledWith('start', onStart);
        expect(mockBot.command).toHaveBeenCalledWith('setup', onSetup);
        expect(mockBot.on).toHaveBeenNthCalledWith(1, 'message', onGenericMessage);
        expect(mockBot.on).toHaveBeenNthCalledWith(2, 'edited_message', handleEditedMessage);
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
        const mockDB = {} as Partial<DynamoDBService>;

        registerHandlers(mockBot as unknown as Bot, mockDB as DynamoDBService);

        const withBotMiddleware = middlewares[0];

        const mockCtx = {
            api: {
                getMe: vi.fn().mockResolvedValue({ first_name: 'Bot', id: 123 }),
            },
            from: {
                id: 456,
            },
            me: undefined,
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

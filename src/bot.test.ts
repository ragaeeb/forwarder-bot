import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Bot } from './bot.js';
import { TelegramUpdate } from './types/telegram.js';
import { isUpdateSentFromBot } from './utils/messageUtils.js';

vi.mock('./services/telegramAPI.js', () => ({
    TelegramAPI: vi.fn().mockImplementation(() => ({
        sendMessage: vi.fn().mockResolvedValue({ message_id: 123 }),
    })),
}));

vi.mock('./utils/messageUtils.js');

describe('Bot', () => {
    let bot: Bot;

    beforeEach(() => {
        vi.clearAllMocks();
        bot = new Bot('test-token');
    });

    describe('constructor', () => {
        it('should create a new bot instance with token', () => {
            expect(bot).toBeInstanceOf(Bot);
            expect(bot.api).toBeDefined();
        });
    });

    describe('command', () => {
        it('should register a command handler without middleware', async () => {
            const handler = vi.fn();
            bot.command('start', handler);

            const update = {
                message: {
                    chat: { id: 789, type: 'private' },
                    date: 1645564800,
                    from: { first_name: 'Test', id: 789, is_bot: false },
                    message_id: 456,
                    text: '/start',
                },
                update_id: 123,
            };

            await bot.handleUpdate(update as unknown as TelegramUpdate);

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith(
                expect.objectContaining({
                    args: undefined,
                    bot,
                    chat: { id: 789, type: 'private' },
                    from: { first_name: 'Test', id: 789, is_bot: false },
                    message: update.message,
                    text: '/start',
                    update,
                }),
            );
        });

        it('should register a command handler with middleware', async () => {
            const middleware1 = vi.fn().mockImplementation((ctx, next) => next());
            const middleware2 = vi.fn().mockImplementation((ctx, next) => next());
            const handler = vi.fn();

            bot.command('test', middleware1, middleware2, handler);

            const update = {
                message: {
                    chat: { id: 789, type: 'private' },
                    date: 1645564800,
                    from: { first_name: 'Test', id: 789, is_bot: false },
                    message_id: 456,
                    text: '/test arg1 arg2',
                },
                update_id: 123,
            };

            await bot.handleUpdate(update as unknown as TelegramUpdate);

            expect(middleware1).toHaveBeenCalledTimes(1);
            expect(middleware2).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith(
                expect.objectContaining({
                    args: 'arg1 arg2',
                    bot,
                    chat: { id: 789, type: 'private' },
                    from: { first_name: 'Test', id: 789, is_bot: false },
                    message: update.message,
                    text: '/test arg1 arg2',
                    update,
                }),
            );
        });

        it('should handle middleware stopping execution chain', async () => {
            const middleware = vi.fn().mockImplementation(() => {}); // doesn't call next()
            const handler = vi.fn();

            bot.command('stop', middleware, handler);

            const update = {
                message: {
                    chat: { id: 789, type: 'private' },
                    date: 1645564800,
                    from: { first_name: 'Test', id: 789, is_bot: false },
                    message_id: 456,
                    text: '/stop',
                },
                update_id: 123,
            };

            await bot.handleUpdate(update as unknown as TelegramUpdate);

            expect(middleware).toHaveBeenCalledTimes(1);
            expect(handler).not.toHaveBeenCalled();
        });

        it('should register multiple handlers for the same command', async () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            bot.command('multi', handler1);
            bot.command('multi', handler2);

            const update = {
                message: {
                    chat: { id: 789, type: 'private' },
                    date: 1645564800,
                    from: { first_name: 'Test', id: 789, is_bot: false },
                    message_id: 456,
                    text: '/multi',
                },
                update_id: 123,
            };

            await bot.handleUpdate(update as unknown as TelegramUpdate);

            expect(handler1).toHaveBeenCalledTimes(1);
            expect(handler2).toHaveBeenCalledTimes(1);
        });
    });

    describe('on', () => {
        it('should register an update handler without middleware', async () => {
            const handler = vi.fn();
            bot.on('message', handler);

            const update = {
                message: {
                    chat: { id: 789, type: 'private' },
                    date: 1645564800,
                    from: { first_name: 'Test', id: 789, is_bot: false },
                    message_id: 456,
                    text: 'Hello',
                },
                update_id: 123,
            };

            await bot.handleUpdate(update as unknown as TelegramUpdate);

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith(
                expect.objectContaining({
                    bot,
                    chat: { id: 789, type: 'private' },
                    from: { first_name: 'Test', id: 789, is_bot: false },
                    message: update.message,
                    text: 'Hello',
                    update,
                }),
            );
        });

        it('should register an update handler with middleware', async () => {
            const middleware1 = vi.fn().mockImplementation((ctx, next) => next());
            const middleware2 = vi.fn().mockImplementation((ctx, next) => next());
            const handler = vi.fn();

            bot.on('message', middleware1, middleware2, handler);

            const update = {
                message: {
                    chat: { id: 789, type: 'private' },
                    date: 1645564800,
                    from: { first_name: 'Test', id: 789, is_bot: false },
                    message_id: 456,
                    text: 'Hello',
                },
                update_id: 123,
            };

            await bot.handleUpdate(update as unknown as TelegramUpdate);

            expect(middleware1).toHaveBeenCalledTimes(1);
            expect(middleware2).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledTimes(1);
        });

        it('should register multiple handlers for the same update type', async () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            bot.on('message', handler1);
            bot.on('message', handler2);

            const update = {
                message: {
                    chat: { id: 789, type: 'private' },
                    date: 1645564800,
                    from: { first_name: 'Test', id: 789, is_bot: false },
                    message_id: 456,
                    text: 'Hello',
                },
                update_id: 123,
            };

            await bot.handleUpdate(update as unknown as TelegramUpdate);

            expect(handler1).toHaveBeenCalledTimes(1);
            expect(handler2).toHaveBeenCalledTimes(1);
        });

        it('should handle edited_message updates', async () => {
            const handler = vi.fn();
            bot.on('edited_message', handler);

            const update = {
                edited_message: {
                    chat: { id: 789, type: 'private' },
                    date: 1645564800,
                    edit_date: 1645564900,
                    from: { first_name: 'Test', id: 789, is_bot: false },
                    message_id: 456,
                    text: 'Edited message',
                },
                update_id: 123,
            };

            await bot.handleUpdate(update as unknown as TelegramUpdate);

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith(
                expect.objectContaining({
                    bot,
                    chat: { id: 789, type: 'private' },
                    from: { first_name: 'Test', id: 789, is_bot: false },
                    message: update.edited_message,
                    text: 'Edited message',
                    update,
                }),
            );
        });
    });

    describe('use', () => {
        it('should register global middleware', async () => {
            const middleware = vi.fn().mockImplementation((ctx, next) => next());
            const handler = vi.fn();

            bot.use(middleware);
            bot.command('start', handler);

            const update = {
                message: {
                    chat: { id: 789, type: 'private' },
                    date: 1645564800,
                    from: { first_name: 'Test', id: 789, is_bot: false },
                    message_id: 456,
                    text: '/start',
                },
                update_id: 123,
            };

            await bot.handleUpdate(update as unknown as TelegramUpdate);

            expect(middleware).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledTimes(1);
        });

        it('should execute global middleware in order', async () => {
            const calls: string[] = [];

            const middleware1 = vi.fn().mockImplementation((ctx, next) => {
                calls.push('middleware1-before');
                return next().then(() => calls.push('middleware1-after'));
            });

            const middleware2 = vi.fn().mockImplementation((ctx, next) => {
                calls.push('middleware2-before');
                return next().then(() => calls.push('middleware2-after'));
            });

            const handler = vi.fn().mockImplementation(() => {
                calls.push('handler');
            });

            bot.use(middleware1);
            bot.use(middleware2);
            bot.command('start', handler);

            const update = {
                message: {
                    chat: { id: 789, type: 'private' },
                    date: 1645564800,
                    from: { first_name: 'Test', id: 789, is_bot: false },
                    message_id: 456,
                    text: '/start',
                },
                update_id: 123,
            };

            await bot.handleUpdate(update as unknown as TelegramUpdate);

            expect(calls).toEqual([
                'middleware1-before',
                'middleware2-before',
                'handler',
                'middleware2-after',
                'middleware1-after',
            ]);
        });

        it('should stop execution chain when middleware does not call next', async () => {
            const middleware = vi.fn(); // doesn't call next
            const handler = vi.fn();

            bot.use(middleware);
            bot.command('start', handler);

            const update = {
                message: {
                    chat: { id: 789, type: 'private' },
                    date: 1645564800,
                    from: { first_name: 'Test', id: 789, is_bot: false },
                    message_id: 456,
                    text: '/start',
                },
                update_id: 123,
            };

            await bot.handleUpdate(update as unknown as TelegramUpdate);

            expect(middleware).toHaveBeenCalledTimes(1);
            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('handleUpdate', () => {
        it('should ignore updates from bots', async () => {
            const handler = vi.fn();
            bot.on('message', handler);

            (isUpdateSentFromBot as any).mockReturnValueOnce(true);

            const update = {
                message: {
                    chat: { id: 789, type: 'private' },
                    date: 1645564800,
                    from: { first_name: 'Bot', id: 789, is_bot: true },
                    message_id: 456,
                    text: 'Hello',
                },
                update_id: 123,
            };

            await bot.handleUpdate(update as unknown as TelegramUpdate);

            expect(handler).not.toHaveBeenCalled();
        });

        it('should handle unsupported update types', async () => {
            const handler = vi.fn();
            bot.on('message', handler);

            const update = {
                // No message or edited_message
                callback_query: {},
                update_id: 123,
            };

            await bot.handleUpdate(update as unknown as TelegramUpdate);

            expect(handler).not.toHaveBeenCalled();
        });

        it('should handle errors during update processing', async () => {
            const error = new Error('Test error');
            const handler = vi.fn().mockRejectedValue(error);
            bot.on('message', handler);

            const update = {
                message: {
                    chat: { id: 789, type: 'private' },
                    date: 1645564800,
                    from: { first_name: 'Test', id: 789, is_bot: false },
                    message_id: 456,
                    text: 'Hello',
                },
                update_id: 123,
            };

            await expect(bot.handleUpdate(update as unknown as TelegramUpdate)).resolves.not.toThrow();
            expect(handler).toHaveBeenCalledTimes(1);
        });
    });

    describe('context methods', () => {
        it('should create reply function that sends message', async () => {
            let contextReply: any;

            const handler = vi.fn().mockImplementation((ctx) => {
                contextReply = ctx.reply;
                return ctx.reply('Reply text');
            });

            bot.on('message', handler);

            const update = {
                message: {
                    chat: { id: 789, type: 'private' },
                    date: 1645564800,
                    from: { first_name: 'Test', id: 789, is_bot: false },
                    message_id: 456,
                    text: 'Hello',
                },
                update_id: 123,
            };

            await bot.handleUpdate(update as unknown as TelegramUpdate);

            expect(handler).toHaveBeenCalledTimes(1);
            expect(contextReply).toBeDefined();
            expect(bot.api.sendMessage).toHaveBeenCalledWith({
                chat_id: 789,
                message_thread_id: undefined,
                text: 'Reply text',
            });
        });
    });
});

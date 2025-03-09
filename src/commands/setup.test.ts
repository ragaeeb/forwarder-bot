import type { ForwardContext } from '@/types.js';

import logger from '@/utils/logger.js';
import { replyWithError, replyWithSuccess } from '@/utils/replyUtils.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { onSetup } from './setup.js';

vi.mock('@/config.js', () => ({
    config: {
        BOT_TOKEN: 'mock-bot-token:123456',
    },
}));

vi.mock('@/utils/logger.js', () => ({
    default: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
}));

vi.mock('@/utils/replyUtils.js', () => ({
    replyWithError: vi.fn().mockResolvedValue({}),
    replyWithSuccess: vi.fn().mockResolvedValue({}),
}));

describe('setup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2023-01-01T12:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('onSetup', () => {
        it('should complete setup successfully with correct token and supergroup', async () => {
            const mockUser = {
                first_name: 'Test',
                id: 123456,
                is_bot: false,
            };

            const ctx = {
                api: {
                    createForumTopic: vi.fn().mockResolvedValue({
                        message_thread_id: 1234,
                        name: 'Test Topic Permissions',
                    }),
                    deleteForumTopic: vi.fn().mockResolvedValue(true),
                },
                args: 'mock-bot-token:123456',
                chat: {
                    id: 9876543,
                    type: 'supergroup',
                },
                db: {
                    saveConfig: vi.fn().mockResolvedValue({
                        adminGroupId: '9876543',
                        configId: 'main',
                        setupAt: '2023-01-01T12:00:00.000Z',
                        setupBy: mockUser,
                    }),
                },
                reply: vi.fn(),
                update: {
                    message: {
                        from: mockUser,
                    },
                },
            } as unknown as ForwardContext;

            await onSetup(ctx);

            expect(ctx.api.createForumTopic).toHaveBeenCalledWith({
                chat_id: 9876543,
                name: 'Test Topic Permissions',
            });

            expect(ctx.api.deleteForumTopic).toHaveBeenCalledWith({
                chat_id: 9876543,
                message_thread_id: 1234,
            });

            expect(ctx.db.saveConfig).toHaveBeenCalledWith({
                adminGroupId: '9876543',
                configId: 'main',
                setupAt: '2023-01-01T12:00:00.000Z',
                setupBy: mockUser,
            });

            expect(replyWithSuccess).toHaveBeenCalledWith(
                ctx,
                expect.stringContaining('Setup complete! Group 9876543 is now set as the contact inbox'),
            );
        });

        it('should reject setup in non-supergroup chats', async () => {
            const ctx = {
                api: {
                    createForumTopic: vi.fn(),
                    deleteForumTopic: vi.fn(),
                },
                args: 'mock-bot-token:123456',
                chat: {
                    id: 9876543,
                    type: 'group',
                },
                db: {
                    saveConfig: vi.fn(),
                },
                reply: vi.fn().mockResolvedValue({}),
            } as unknown as ForwardContext;

            await onSetup(ctx);

            expect(ctx.reply).toHaveBeenCalledWith('⚠️ This command must be used in a supergroup with topics enabled');
            expect(ctx.api.createForumTopic).not.toHaveBeenCalled();
            expect(ctx.db.saveConfig).not.toHaveBeenCalled();
            expect(replyWithSuccess).not.toHaveBeenCalled();
        });

        it('should handle errors during setup', async () => {
            const error = new Error('Permission denied');
            const ctx = {
                api: {
                    createForumTopic: vi.fn().mockRejectedValue(error),
                    deleteForumTopic: vi.fn(),
                },
                args: 'mock-bot-token:123456',
                chat: {
                    id: 9876543,
                    type: 'supergroup',
                },
                db: {
                    saveConfig: vi.fn(),
                },
                update: {
                    message: {
                        from: { first_name: 'Test', id: 123456, is_bot: false },
                    },
                },
            } as unknown as ForwardContext;

            await onSetup(ctx);

            expect(logger.error).toHaveBeenCalledOnce();
            expect(replyWithError).toHaveBeenCalledWith(
                ctx,
                'Setup failed. Please ensure topics are enabled and the bot has privileges to Manage Topics.',
            );
            expect(ctx.db.saveConfig).not.toHaveBeenCalled();
        });

        it('should do nothing when token is not provided', async () => {
            const ctx = {
                api: {
                    createForumTopic: vi.fn(),
                    deleteForumTopic: vi.fn(),
                },
                args: null,
                chat: {
                    id: 9876543,
                    type: 'supergroup',
                },
                db: {
                    saveConfig: vi.fn(),
                },
            } as unknown as ForwardContext;

            await onSetup(ctx);

            expect(ctx.api.createForumTopic).not.toHaveBeenCalled();
            expect(ctx.db.saveConfig).not.toHaveBeenCalled();
            expect(replyWithSuccess).not.toHaveBeenCalled();
        });

        it('should log warning when invalid token is provided', async () => {
            const ctx = {
                api: {
                    createForumTopic: vi.fn(),
                    deleteForumTopic: vi.fn(),
                },
                args: 'invalid-token',
                chat: {
                    id: 9876543,
                    type: 'supergroup',
                },
                db: {
                    saveConfig: vi.fn(),
                },
            } as unknown as ForwardContext;

            await onSetup(ctx);

            expect(logger.warn).toHaveBeenCalledOnce();
            expect(ctx.api.createForumTopic).not.toHaveBeenCalled();
            expect(ctx.db.saveConfig).not.toHaveBeenCalled();
            expect(replyWithSuccess).not.toHaveBeenCalled();
        });
    });
});

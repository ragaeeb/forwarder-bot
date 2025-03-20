import type { ForwardContext } from '@/types.js';

import { replyWithError, replyWithSuccess, replyWithWarning } from '@/utils/replyUtils.js';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';

import { onSetup } from './setup.js';

vi.mock('@/config.js', () => ({
    config: {
        BOT_TOKEN: 'BT',
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
    replyWithError: vi.fn(),
    replyWithSuccess: vi.fn(),
    replyWithWarning: vi.fn(),
}));

vi.mock('@/utils/security.js', () => ({
    hashToken: vi.fn().mockReturnValue('HBT'),
}));

describe('setup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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

            const config = {
                adminGroupId: '1',
                configId: 'main',
                setupAt: '2023-01-01T12:00:00.000Z',
                setupBy: mockUser,
            };

            const ctx = {
                args: 'HBT',
                bot: {
                    api: {
                        createForumTopic: vi.fn().mockResolvedValue({
                            message_thread_id: 1234,
                            name: 'Test Topic Permissions',
                        }),
                        deleteForumTopic: vi.fn(),
                        getChatMember: vi.fn().mockResolvedValue({ status: 'administrator' }),
                    },
                },
                chat: {
                    id: 1,
                    type: 'supergroup',
                },
                db: {
                    saveSettings: vi.fn().mockResolvedValue(config),
                },
                from: { id: 123456 },
                reply: vi.fn(),
                update: {
                    message: {
                        from: mockUser,
                    },
                },
            } as unknown as ForwardContext;

            await onSetup(ctx);

            expect(ctx.bot.api.createForumTopic).toHaveBeenCalledWith({
                chat_id: 1,
                name: 'Test Topic Permissions',
            });
            expect(ctx.bot.api.createForumTopic).toHaveBeenCalledOnce();

            expect(ctx.bot.api.deleteForumTopic).toHaveBeenCalledWith({
                chat_id: 1,
                message_thread_id: 1234,
            });
            expect(ctx.bot.api.deleteForumTopic).toHaveBeenCalledOnce();

            expect(ctx.bot.api.getChatMember).toHaveBeenCalledExactlyOnceWith({
                chat_id: 1,
                user_id: 123456,
            });

            expect(ctx.db.saveSettings).toHaveBeenCalledWith(config);
            expect(ctx.db.saveSettings).toHaveBeenCalledOnce();

            expect(replyWithSuccess).toHaveBeenCalledWith(ctx, expect.any(String));
        });

        it('should notify previous group and leave it if we were already configured', async () => {
            const ctx = {
                api: {
                    leaveChat: vi.fn(),
                },
                args: 'HBT',
                bot: {
                    api: {
                        createForumTopic: vi.fn().mockResolvedValue({}),
                        deleteForumTopic: vi.fn(),
                        getChatMember: vi.fn().mockResolvedValue({ status: 'creator' }),
                    },
                },
                chat: {
                    id: 2,
                    type: 'supergroup',
                },
                db: {
                    saveSettings: vi.fn(),
                },
                reply: vi.fn(),
                settings: {
                    adminGroupId: '1',
                },
            } as unknown as ForwardContext;

            await onSetup(ctx);

            expect(ctx.bot.api.createForumTopic).toHaveBeenCalledOnce();
            expect(ctx.bot.api.deleteForumTopic).toHaveBeenCalledOnce();
            expect(ctx.db.saveSettings).toHaveBeenCalledOnce();

            expect(ctx.api.leaveChat).toHaveBeenCalledOnce();
            expect(ctx.api.leaveChat).toHaveBeenCalledWith({ chat_id: '1' });

            expect(replyWithWarning).toHaveBeenCalledOnce();
            expect(replyWithWarning).toHaveBeenCalledWith(ctx, expect.any(String));
            expect(replyWithSuccess).toHaveBeenCalledOnce();
        });

        it('should continue setup even if there is an error leaving old group', async () => {
            const ctx = {
                api: {
                    leaveChat: vi.fn().mockRejectedValue(new Error('Could not leave group')),
                },
                args: 'HBT',
                bot: {
                    api: {
                        createForumTopic: vi.fn().mockResolvedValue({}),
                        deleteForumTopic: vi.fn(),
                        getChatMember: vi.fn().mockResolvedValue({ status: 'administrator' }),
                    },
                },
                chat: {
                    id: 2,
                    type: 'supergroup',
                },
                db: {
                    saveSettings: vi.fn(),
                },
                reply: vi.fn(),
                settings: {
                    adminGroupId: '1',
                },
            } as unknown as ForwardContext;

            await onSetup(ctx);

            expect(ctx.bot.api.createForumTopic).toHaveBeenCalledOnce();
            expect(ctx.bot.api.deleteForumTopic).toHaveBeenCalledOnce();
            expect(ctx.db.saveSettings).toHaveBeenCalledOnce();
            expect(ctx.api.leaveChat).toHaveBeenCalledOnce();

            expect(replyWithWarning).toHaveBeenCalledOnce();
            expect(replyWithSuccess).toHaveBeenCalledOnce();
        });

        it('should reject setup from non-admins', async () => {
            const ctx = {
                args: 'HBT',
                bot: {
                    api: {
                        createForumTopic: vi.fn().mockResolvedValue({}),
                        getChatMember: vi.fn().mockResolvedValue({ status: 'member' }),
                    },
                },
                chat: {
                    id: 2,
                    type: 'supergroup',
                },
                db: {
                    saveSettings: vi.fn(),
                },
                reply: vi.fn(),
                settings: {
                    adminGroupId: '1',
                },
            } as unknown as ForwardContext;

            await onSetup(ctx);

            expect(ctx.bot.api.createForumTopic).not.toHaveBeenCalled();
            expect(ctx.db.saveSettings).not.toHaveBeenCalled();

            expect(replyWithWarning).toHaveBeenCalledOnce();
            expect(replyWithSuccess).not.toHaveBeenCalledOnce();
        });

        it('should be a no-op if we are trying to setup when we are already configured', async () => {
            const ctx = {
                args: 'HBT',
                bot: {
                    api: {
                        createForumTopic: vi.fn().mockResolvedValue({}),
                        getChatMember: vi.fn().mockResolvedValue({ status: 'administrator' }),
                    },
                },
                chat: {
                    id: 1,
                    type: 'supergroup',
                },
                db: {
                    saveSettings: vi.fn(),
                },
                settings: {
                    adminGroupId: '1',
                },
            } as unknown as ForwardContext;

            (replyWithWarning as Mock).mockResolvedValue({});

            await onSetup(ctx);

            expect(ctx.bot.api.createForumTopic).not.toHaveBeenCalled();
            expect(ctx.db.saveSettings).not.toHaveBeenCalled();

            expect(replyWithWarning).toHaveBeenCalledExactlyOnceWith(ctx, expect.any(String));
            expect(replyWithSuccess).not.toHaveBeenCalled();
        });

        it('should reject setup in non-supergroup chats', async () => {
            const ctx = {
                args: 'HBT',
                bot: {
                    api: {
                        createForumTopic: vi.fn(),
                    },
                },
                chat: {
                    id: 1,
                    type: 'group',
                },
                db: {
                    saveSettings: vi.fn(),
                },
                reply: vi.fn().mockResolvedValue({}),
            } as unknown as ForwardContext;

            await onSetup(ctx);

            expect(replyWithWarning).toHaveBeenCalledExactlyOnceWith(
                ctx,
                'This command must be used in a supergroup with topics enabled',
            );
            expect(ctx.bot.api.createForumTopic).not.toHaveBeenCalled();
            expect(ctx.db.saveSettings).not.toHaveBeenCalled();
            expect(replyWithSuccess).not.toHaveBeenCalled();
        });

        it('should handle errors during setup', async () => {
            const error = new Error('Permission denied');
            const ctx = {
                args: 'HBT',
                bot: {
                    api: {
                        createForumTopic: vi.fn().mockRejectedValue(error),
                        deleteForumTopic: vi.fn(),
                    },
                },
                chat: {
                    id: 1,
                    type: 'supergroup',
                },
                db: {
                    saveSettings: vi.fn(),
                },
                update: {
                    message: {
                        from: { first_name: 'Test', id: 123456, is_bot: false },
                    },
                },
            } as unknown as ForwardContext;

            await onSetup(ctx);

            expect(replyWithError).toHaveBeenCalledWith(ctx, expect.any(String));
            expect(ctx.db.saveSettings).not.toHaveBeenCalled();
        });

        it('should do nothing when token is not provided', async () => {
            const ctx = {
                args: null,
                bot: {
                    api: {
                        createForumTopic: vi.fn(),
                        deleteForumTopic: vi.fn(),
                    },
                },
                chat: {
                    id: 1,
                    type: 'supergroup',
                },
                db: {
                    saveSettings: vi.fn(),
                },
            } as unknown as ForwardContext;

            await onSetup(ctx);

            expect(ctx.bot.api.createForumTopic).not.toHaveBeenCalled();
            expect(ctx.db.saveSettings).not.toHaveBeenCalled();
            expect(replyWithSuccess).not.toHaveBeenCalled();
        });

        it('should just log when an invalid token is provided', async () => {
            const ctx = {
                args: 'invalid-token',
                bot: {
                    api: {
                        createForumTopic: vi.fn(),
                        deleteForumTopic: vi.fn(),
                    },
                },
                chat: {
                    id: 1,
                    type: 'supergroup',
                },
                db: {
                    saveSettings: vi.fn(),
                },
            } as unknown as ForwardContext;

            await onSetup(ctx);

            expect(ctx.bot.api.createForumTopic).not.toHaveBeenCalled();
            expect(ctx.db.saveSettings).not.toHaveBeenCalled();
            expect(replyWithSuccess).not.toHaveBeenCalled();
            expect(replyWithError).not.toHaveBeenCalled();
        });
    });
});

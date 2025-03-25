import type { ForwardContext } from '@/types/app.js';

import { replyWithError, replyWithSuccess, replyWithWarning } from '@/utils/replyUtils.js';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { onSetup } from './setup.js';

vi.mock('@/utils/replyUtils.js');

describe('setup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.setSystemTime(new Date('2023-01-01T12:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('onSetup', () => {
        it('should save the group id and send success message', async () => {
            const mockUser = {
                first_name: 'Test',
                id: 123456,
            };

            const ctx = {
                chat: {
                    id: 1,
                },
                db: {
                    saveSettings: vi.fn(),
                },
                from: mockUser,
            } as unknown as ForwardContext;

            await onSetup(ctx);

            expect(ctx.db.saveSettings).toHaveBeenCalledExactlyOnceWith({
                adminGroupId: '1',
                configId: 'main',
                setupAt: '2023-01-01T12:00:00.000Z',
                setupBy: mockUser,
            });

            expect(replyWithSuccess).toHaveBeenCalledExactlyOnceWith(ctx, expect.any(String));
        });

        it('should notify previous group and leave it if we were already configured', async () => {
            const ctx = {
                bot: {
                    api: {
                        leaveChat: vi.fn(),
                    },
                },
                chat: {
                    id: 2,
                },
                db: {
                    saveSettings: vi.fn(),
                },
                settings: {
                    adminGroupId: '1',
                },
            } as unknown as ForwardContext;

            await onSetup(ctx);

            expect(ctx.db.saveSettings).toHaveBeenCalledOnce();
            expect(ctx.bot.api.leaveChat).toHaveBeenCalledExactlyOnceWith({ chat_id: '1' });
            expect(replyWithWarning).toHaveBeenCalledExactlyOnceWith(ctx, expect.any(String));
            expect(replyWithSuccess).toHaveBeenCalledExactlyOnceWith(ctx, expect.any(String));
        });

        it('should continue setup even if there is an error leaving old group', async () => {
            const ctx = {
                bot: {
                    api: {
                        leaveChat: vi.fn().mockRejectedValue(new Error('Cannot leave')),
                    },
                },
                chat: {
                    id: 2,
                },
                db: {
                    saveSettings: vi.fn(),
                },
                settings: {
                    adminGroupId: '1',
                },
            } as unknown as ForwardContext;

            await onSetup(ctx);

            expect(ctx.db.saveSettings).toHaveBeenCalledOnce();
            expect(ctx.bot.api.leaveChat).toHaveBeenCalledExactlyOnceWith({ chat_id: '1' });
            expect(replyWithWarning).toHaveBeenCalledOnce();
            expect(replyWithSuccess).toHaveBeenCalledOnce();
        });

        it('should continue setup even if there is an error notifying of the old group', async () => {
            const ctx = {
                bot: {
                    api: {
                        leaveChat: vi.fn().mockRejectedValue(new Error('Cannot leave')),
                    },
                },
                chat: {
                    id: 2,
                },
                db: {
                    saveSettings: vi.fn(),
                },
                settings: {
                    adminGroupId: '1',
                },
            } as unknown as ForwardContext;

            (replyWithWarning as Mock).mockRejectedValue(new Error('Cannot reply'));

            await onSetup(ctx);

            expect(ctx.db.saveSettings).toHaveBeenCalledOnce();
            expect(ctx.bot.api.leaveChat).not.toHaveBeenCalled();
            expect(replyWithWarning).toHaveBeenCalledOnce();
            expect(replyWithSuccess).toHaveBeenCalledOnce();
        });

        it('should handle errors', async () => {
            const ctx = {
                chat: {
                    id: 2,
                },
                db: {
                    saveSettings: vi.fn().mockRejectedValue(new Error()),
                },
            } as unknown as ForwardContext;

            (replyWithWarning as Mock).mockRejectedValue(new Error('Cannot reply'));

            await onSetup(ctx);

            expect(replyWithError).toHaveBeenCalledOnce();
            expect(replyWithSuccess).not.toHaveBeenCalled();
        });
    });
});

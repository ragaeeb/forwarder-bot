import { afterEach, beforeEach, describe, expect, it, type Mock, mock, setSystemTime } from 'bun:test';
import type { ForwardContext } from '@/types/app.js';
import { replyWithError, replyWithSuccess, replyWithWarning } from '@/utils/replyUtils.js';

import { onSetup } from './setup.js';

mock.module('@/utils/replyUtils.js', () => ({
    replyWithError: mock(() => {}),
    replyWithSuccess: mock(() => {}),
    replyWithWarning: mock(() => {}),
}));

describe('setup', () => {
    beforeEach(() => {
        mock.clearAllMocks();
        setSystemTime(new Date('2023-01-01T12:00:00Z'));
    });

    afterEach(() => {
        setSystemTime();
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
                    saveSettings: mock(() => {}),
                },
                from: mockUser,
            } as unknown as ForwardContext;

            await onSetup(ctx);

            expect(ctx.db.saveSettings).toHaveBeenCalledTimes(1);
            expect(ctx.db.saveSettings).toHaveBeenCalledWith({
                adminGroupId: '1',
                setupAt: '2023-01-01T12:00:00.000Z',
                setupBy: mockUser,
            });

            expect(replyWithSuccess).toHaveBeenCalledTimes(1);
            expect(replyWithSuccess).toHaveBeenCalledWith(ctx, expect.any(String));
        });

        it('should notify previous group and leave it if we were already configured', async () => {
            const ctx = {
                bot: {
                    api: {
                        leaveChat: mock(() => {}),
                    },
                },
                chat: {
                    id: 2,
                },
                db: {
                    saveSettings: mock(() => {}),
                },
                settings: {
                    adminGroupId: '1',
                },
            } as unknown as ForwardContext;

            await onSetup(ctx);

            expect(ctx.db.saveSettings).toHaveBeenCalledTimes(1);
            expect(ctx.bot.api.leaveChat).toHaveBeenCalledTimes(1);
            expect(ctx.bot.api.leaveChat).toHaveBeenCalledWith({ chat_id: '1' });
            expect(replyWithWarning).toHaveBeenCalledTimes(1);
            expect(replyWithWarning).toHaveBeenCalledWith(ctx, expect.any(String));
            expect(replyWithSuccess).toHaveBeenCalledTimes(1);
            expect(replyWithSuccess).toHaveBeenCalledWith(ctx, expect.any(String));
        });

        it('should continue setup even if there is an error leaving old group', async () => {
            const ctx = {
                bot: {
                    api: {
                        leaveChat: mock(() => Promise.reject(new Error('Cannot leave'))),
                    },
                },
                chat: {
                    id: 2,
                },
                db: {
                    saveSettings: mock(() => {}),
                },
                settings: {
                    adminGroupId: '1',
                },
            } as unknown as ForwardContext;

            await onSetup(ctx);

            expect(ctx.db.saveSettings).toHaveBeenCalledTimes(1);
            expect(ctx.bot.api.leaveChat).toHaveBeenCalledTimes(1);
            expect(ctx.bot.api.leaveChat).toHaveBeenCalledWith({ chat_id: '1' });
            expect(replyWithWarning).toHaveBeenCalledTimes(1);
            expect(replyWithSuccess).toHaveBeenCalledTimes(1);
        });

        it('should continue setup even if there is an error notifying of the old group', async () => {
            const ctx = {
                bot: {
                    api: {
                        leaveChat: mock(() => Promise.reject(new Error('Cannot leave'))),
                    },
                },
                chat: {
                    id: 2,
                },
                db: {
                    saveSettings: mock(() => {}),
                },
                settings: {
                    adminGroupId: '1',
                },
            } as unknown as ForwardContext;

            (replyWithWarning as Mock).mockRejectedValue(new Error('Cannot reply'));

            await onSetup(ctx);

            expect(ctx.db.saveSettings).toHaveBeenCalledTimes(1);
            expect(ctx.bot.api.leaveChat).not.toHaveBeenCalled();
            expect(replyWithWarning).toHaveBeenCalledTimes(1);
            expect(replyWithSuccess).toHaveBeenCalledTimes(1);
        });

        it('should handle errors', async () => {
            const ctx = {
                chat: {
                    id: 2,
                },
                db: {
                    saveSettings: mock(() => Promise.reject(new Error())),
                },
            } as unknown as ForwardContext;

            (replyWithWarning as Mock).mockRejectedValue(new Error('Cannot reply'));

            await onSetup(ctx);

            expect(replyWithError).toHaveBeenCalledTimes(1);
            expect(replyWithSuccess).not.toHaveBeenCalled();
        });
    });
});

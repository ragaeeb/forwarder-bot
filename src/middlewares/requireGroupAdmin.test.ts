import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { NextFunction } from '@/bot.js';
import type { ForwardContext } from '@/types/app.js';
import { replyWithWarning } from '@/utils/replyUtils.js';

import { requireGroupAdmin } from './requireGroupAdmin.js';

mock.module('@/utils/replyUtils.js', () => ({
    replyWithWarning: mock(() => {}),
}));

describe('requireGroupAdmin', () => {
    let next: NextFunction;

    beforeEach(() => {
        mock.clearAllMocks();
        next = mock(() => {});
    });

    it('should reject in non-supergroup chats', async () => {
        const ctx = {
            chat: {
                id: 1,
                type: 'group',
            },
        };

        await requireGroupAdmin(ctx as unknown as ForwardContext, next);

        expect(replyWithWarning).toHaveBeenCalledTimes(1);
        expect(replyWithWarning).toHaveBeenCalledWith(ctx, expect.any(String));
        expect(next).not.toHaveBeenCalled();
    });

    it('should reject from non-admins', async () => {
        const ctx = {
            bot: {
                api: {
                    getChatMember: mock(() => Promise.resolve({ status: 'member' })),
                },
            },
            chat: {
                id: 1,
                type: 'supergroup',
            },
            from: { id: 2 },
        };

        await requireGroupAdmin(ctx as unknown as ForwardContext, next);

        expect(replyWithWarning).toHaveBeenCalledTimes(1);
        expect(replyWithWarning).toHaveBeenCalledWith(ctx, expect.any(String));
        expect(ctx.bot.api.getChatMember).toHaveBeenCalledTimes(1);
        expect(ctx.bot.api.getChatMember).toHaveBeenCalledWith({ chat_id: 1, user_id: 2 });
        expect(next).not.toHaveBeenCalled();
    });

    it.each(['administrator', 'creator'])('should pass if user is in supergroup and status=%s', async (status) => {
        const ctx = {
            bot: {
                api: {
                    getChatMember: mock(() => Promise.resolve({ status })),
                },
            },
            chat: {
                id: 1,
                type: 'supergroup',
            },
            from: { id: 1 },
        };

        await requireGroupAdmin(ctx as unknown as ForwardContext, next);

        expect(replyWithWarning).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledWith();
    });
});

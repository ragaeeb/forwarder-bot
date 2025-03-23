import type { NextFunction } from '@/bot.js';
import type { ForwardContext } from '@/types.js';

import { replyWithWarning } from '@/utils/replyUtils.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requireGroupAdmin } from './requireGroupAdmin.js';

vi.mock('@/utils/replyUtils.js');

describe('requireGroupAdmin', () => {
    let next: NextFunction;

    beforeEach(() => {
        vi.clearAllMocks();
        next = vi.fn();
    });

    it('should reject in non-supergroup chats', async () => {
        const ctx = {
            chat: {
                id: 1,
                type: 'group',
            },
        };

        await requireGroupAdmin(ctx as unknown as ForwardContext, next);

        expect(replyWithWarning).toHaveBeenCalledExactlyOnceWith(ctx, expect.any(String));
        expect(next).not.toHaveBeenCalled();
    });

    it('should reject from non-admins', async () => {
        const ctx = {
            bot: {
                api: {
                    getChatMember: vi.fn().mockResolvedValue({ status: 'member' }),
                },
            },
            chat: {
                id: 1,
                type: 'supergroup',
            },
            from: { id: 2 },
        };

        await requireGroupAdmin(ctx as unknown as ForwardContext, next);

        expect(replyWithWarning).toHaveBeenCalledExactlyOnceWith(ctx, expect.any(String));
        expect(ctx.bot.api.getChatMember).toHaveBeenCalledExactlyOnceWith({ chat_id: 1, user_id: 2 });
        expect(next).not.toHaveBeenCalled();
    });

    it.each(['administrator', 'creator'])('should pass if user is in supergroup and status=%s', async (status) => {
        const ctx = {
            bot: {
                api: {
                    getChatMember: vi.fn().mockResolvedValue({ status }),
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
        expect(next).toHaveBeenCalledExactlyOnceWith();
    });
});

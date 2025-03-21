import type { ForwardContext } from '@/types.js';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { replyWithWarning } from './replyUtils.js';
import { isSenderGroupAdmin } from './validation.js';

vi.mock('./logger.js', () => ({
    default: {
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

vi.mock('./replyUtils.js', () => ({
    replyWithError: vi.fn(),
    replyWithWarning: vi.fn(),
}));

describe('validation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('isSenderGroupAdmin', () => {
        it('should reject in non-supergroup chats', async () => {
            const ctx = {
                chat: {
                    id: 1,
                    type: 'group',
                },
            };

            const result = await isSenderGroupAdmin(ctx as unknown as ForwardContext);

            expect(replyWithWarning).toHaveBeenCalledExactlyOnceWith(ctx, expect.any(String));
            expect(result).toBe(false);
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

            const result = await isSenderGroupAdmin(ctx as unknown as ForwardContext);

            expect(replyWithWarning).toHaveBeenCalledExactlyOnceWith(ctx, expect.any(String));
            expect(ctx.bot.api.getChatMember).toHaveBeenCalledExactlyOnceWith({ chat_id: 1, user_id: 2 });
            expect(result).toBe(false);
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
            };

            const result = await isSenderGroupAdmin(ctx as unknown as ForwardContext);

            expect(replyWithWarning).not.toHaveBeenCalled();
            expect(result).toBe(true);
        });
    });
});

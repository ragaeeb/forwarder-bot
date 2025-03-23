import type { NextFunction } from '@/bot.js';
import type { ForwardContext } from '@/types.js';

import { replyWithError } from '@/utils/replyUtils.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requireManageTopicsPermission } from './requireManageTopicsPermission.js';

vi.mock('@/utils/replyUtils.js');

describe('requireManageTopicsPermission', () => {
    let next: NextFunction;

    beforeEach(() => {
        vi.clearAllMocks();
        next = vi.fn();
    });

    it('should fail if bot could not create topic', async () => {
        const ctx = {
            bot: {
                api: {
                    createForumTopic: vi.fn().mockRejectedValue(new Error('Cannot create thread')),
                },
            },
            chat: {
                id: 1,
            },
        };

        await requireManageTopicsPermission(ctx as unknown as ForwardContext, next);

        expect(next).not.toHaveBeenCalled();
        expect(replyWithError).toHaveBeenCalledOnce();
        expect(ctx.bot.api.createForumTopic).toHaveBeenCalledExactlyOnceWith({
            chat_id: 1,
            name: expect.any(String),
        });
    });

    it('should fail if bot could not delete topic', async () => {
        const ctx = {
            bot: {
                api: {
                    createForumTopic: vi.fn().mockResolvedValue({ message_thread_id: 99, name: 'T' }),
                    deleteForumTopic: vi.fn().mockRejectedValue(new Error('Cannot create thread')),
                },
            },
            chat: {
                id: 1,
            },
        };

        await requireManageTopicsPermission(ctx as unknown as ForwardContext, next);

        expect(next).not.toHaveBeenCalled();
        expect(replyWithError).toHaveBeenCalledOnce();
        expect(ctx.bot.api.deleteForumTopic).toHaveBeenCalledExactlyOnceWith({
            chat_id: 1,
            message_thread_id: 99,
        });
    });

    it('should pass if we were able to create and delete the forum topic', async () => {
        const ctx = {
            bot: {
                api: {
                    createForumTopic: vi.fn().mockResolvedValue({ message_thread_id: 99, name: 'T' }),
                    deleteForumTopic: vi.fn().mockResolvedValue(true),
                },
            },
            chat: {
                id: 1,
            },
        };

        await requireManageTopicsPermission(ctx as unknown as ForwardContext, next);

        expect(next).toHaveBeenCalledExactlyOnceWith();
        expect(replyWithError).not.toHaveBeenCalled();
    });
});

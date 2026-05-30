import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { NextFunction } from '@/bot.js';
import type { ForwardContext } from '@/types/app.js';
import { replyWithError } from '@/utils/replyUtils.js';

import { requireManageTopicsPermission } from './requireManageTopicsPermission.js';

mock.module('@/utils/replyUtils.js', () => ({
    replyWithError: mock(() => {}),
}));

describe('requireManageTopicsPermission', () => {
    let next: NextFunction;

    beforeEach(() => {
        mock.clearAllMocks();
        next = mock(() => {});
    });

    it('should fail if bot could not create topic', async () => {
        const ctx = {
            bot: {
                api: {
                    createForumTopic: mock(() => Promise.reject(new Error('Cannot create thread'))),
                },
            },
            chat: {
                id: 1,
            },
        };

        await requireManageTopicsPermission(ctx as unknown as ForwardContext, next);

        expect(next).not.toHaveBeenCalled();
        expect(replyWithError).toHaveBeenCalledTimes(1);
        expect(ctx.bot.api.createForumTopic).toHaveBeenCalledTimes(1);
        expect(ctx.bot.api.createForumTopic).toHaveBeenCalledWith({
            chat_id: 1,
            name: expect.any(String),
        });
    });

    it('should fail if bot could not delete topic', async () => {
        const ctx = {
            bot: {
                api: {
                    createForumTopic: mock(() => Promise.resolve({ message_thread_id: 99, name: 'T' })),
                    deleteForumTopic: mock(() => Promise.reject(new Error('Cannot create thread'))),
                },
            },
            chat: {
                id: 1,
            },
        };

        await requireManageTopicsPermission(ctx as unknown as ForwardContext, next);

        expect(next).not.toHaveBeenCalled();
        expect(replyWithError).toHaveBeenCalledTimes(1);
        expect(ctx.bot.api.deleteForumTopic).toHaveBeenCalledTimes(1);
        expect(ctx.bot.api.deleteForumTopic).toHaveBeenCalledWith({
            chat_id: 1,
            message_thread_id: 99,
        });
    });

    it('should pass if we were able to create and delete the forum topic', async () => {
        const ctx = {
            bot: {
                api: {
                    createForumTopic: mock(() => Promise.resolve({ message_thread_id: 99, name: 'T' })),
                    deleteForumTopic: mock(() => Promise.resolve(true)),
                },
            },
            chat: {
                id: 1,
            },
        };

        await requireManageTopicsPermission(ctx as unknown as ForwardContext, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledWith();
        expect(replyWithError).not.toHaveBeenCalled();
    });
});

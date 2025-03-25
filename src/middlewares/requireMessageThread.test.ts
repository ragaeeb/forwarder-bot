import type { NextFunction } from '@/bot.js';
import type { ForwardContext } from '@/types/app.js';

import { replyWithError } from '@/utils/replyUtils.js';
import { createNewThread, updateThreadByMessage } from '@/utils/threadUtils.js';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { requireReferencedThread, requireThreadForUser } from './requireMessageThread.js';

vi.mock('@/utils/threadUtils.js');
vi.mock('@/utils/replyUtils.js');

describe('requireMessageThread', () => {
    let next: NextFunction;

    beforeEach(() => {
        vi.clearAllMocks();
        next = vi.fn();
    });

    describe('requireThreadForUser', () => {
        it('should update existing thread when found', async () => {
            const thread = {
                threadId: '99',
            };

            const ctx = {
                db: {
                    getThreadByUserId: vi.fn().mockResolvedValue(thread),
                },
                from: {
                    id: 12345,
                },
                message: {
                    message_id: 1,
                },
            } as unknown as ForwardContext;

            (updateThreadByMessage as Mock).mockResolvedValue(thread);

            await requireThreadForUser(ctx, next);

            expect(ctx.db.getThreadByUserId).toHaveBeenCalledExactlyOnceWith('12345');
            expect(updateThreadByMessage).toHaveBeenCalledExactlyOnceWith(ctx, thread, ctx.message);
            expect(next).toHaveBeenCalledExactlyOnceWith();
            expect(ctx.thread).toEqual(thread);
        });

        it('should create a new thread when an existing thread does not exist for the user', async () => {
            const ctx = {
                db: {
                    getThreadByUserId: vi.fn(),
                },
                from: {
                    id: 12345,
                },
                message: {
                    message_id: 1,
                },
            } as unknown as ForwardContext;

            (createNewThread as Mock).mockResolvedValue({
                threadId: '99',
            });

            await requireThreadForUser(ctx, next);

            expect(ctx.db.getThreadByUserId).toHaveBeenCalledExactlyOnceWith('12345');
            expect(createNewThread).toHaveBeenCalledExactlyOnceWith(ctx);
            expect(next).toHaveBeenCalledExactlyOnceWith();
            expect(ctx.thread).toEqual({ threadId: '99' });
        });

        it('should not proceed if there are any errors getting the thread', async () => {
            const ctx = {
                db: {
                    getThreadByUserId: vi.fn().mockRejectedValue(new Error('Error getting thread')),
                },
                from: {
                    id: 12345,
                },
                settings: {},
            } as unknown as ForwardContext;

            await requireThreadForUser(ctx, next);

            expect(createNewThread).not.toHaveBeenCalled();
            expect(next).not.toHaveBeenCalled();
            expect(ctx.thread).toBeUndefined();
            expect(replyWithError).toHaveBeenCalledOnce();
        });

        it('should not proceed if there are any errors creating a new thread', async () => {
            const ctx = {
                db: {
                    getThreadByUserId: vi.fn(),
                },
                from: {
                    id: 12345,
                },
                settings: { failure: 'F' },
            } as unknown as ForwardContext;

            (createNewThread as Mock).mockRejectedValue(new Error('Cannot create thread'));

            await requireThreadForUser(ctx, next);

            expect(next).not.toHaveBeenCalled();
            expect(replyWithError).toHaveBeenCalledExactlyOnceWith(ctx, 'F');
        });

        it('should not proceed if there are any errors updating a thread', async () => {
            const ctx = {
                db: {
                    getThreadByUserId: vi.fn().mockResolvedValue({ threadId: '11' }),
                },
                from: {
                    id: 12345,
                },
                settings: {},
            } as unknown as ForwardContext;

            (updateThreadByMessage as Mock).mockRejectedValue(new Error('Cannot create thread'));

            await requireThreadForUser(ctx, next);

            expect(next).not.toHaveBeenCalled();
            expect(replyWithError).toHaveBeenCalledOnce();
        });
    });

    describe('requireReferencedThread', () => {
        it('should successfully set the thread for the message', async () => {
            const thread = { threadId: '11' };

            const ctx = {
                db: {
                    getThreadById: vi.fn().mockResolvedValue(thread),
                },
                message: {
                    message_thread_id: 11,
                },
            } as unknown as ForwardContext;

            await requireReferencedThread(ctx, next);

            expect(ctx.thread).toEqual(thread);
            expect(next).toHaveBeenCalledExactlyOnceWith();
            expect(replyWithError).not.toHaveBeenCalled();
            expect(ctx.db.getThreadById).toHaveBeenCalledExactlyOnceWith('11');
        });

        it('should catch errors if thread cannot be found', async () => {
            const ctx = {
                db: {
                    getThreadById: vi.fn(),
                },
                message: {
                    message_thread_id: 11,
                },
            } as unknown as ForwardContext;

            await requireReferencedThread(ctx, next);

            expect(ctx.thread).toBeUndefined();
            expect(next).not.toHaveBeenCalled();
            expect(replyWithError).toHaveBeenCalled();
        });

        it('should catch errors if there are problems getting thread', async () => {
            const ctx = {
                db: {
                    getThreadById: vi.fn().mockRejectedValue(new Error('Cannot get thread')),
                },
                message: {
                    message_thread_id: 11,
                },
            } as unknown as ForwardContext;

            await requireReferencedThread(ctx, next);

            expect(ctx.thread).toBeUndefined();
            expect(next).not.toHaveBeenCalled();
            expect(replyWithError).toHaveBeenCalled();
        });
    });
});

import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import type { NextFunction } from '@/bot.js';
import type { ForwardContext } from '@/types/app.js';
import { replyWithError } from '@/utils/replyUtils.js';
import * as threadUtils from '@/utils/threadUtils.js';

import { requireReferencedThread, requireThreadForUser } from './requireMessageThread.js';

const createNewThreadMock = mock(() => {});
const updateThreadByMessageMock = mock(() => {});

mock.module('@/utils/threadUtils.js', () => ({
    createNewThread: createNewThreadMock,
    updateThreadByMessage: updateThreadByMessageMock,
}));
mock.module('@/utils/replyUtils.js', () => ({
    replyWithError: mock(() => {}),
}));

describe('requireMessageThread', () => {
    let next: NextFunction;

    beforeEach(() => {
        mock.clearAllMocks();
        next = mock(() => {});
    });

    afterAll(() => {
        mock.module('@/utils/threadUtils.js', () => threadUtils);
    });

    describe('requireThreadForUser', () => {
        it('should update existing thread when found', async () => {
            const thread = {
                threadId: '99',
            };

            const ctx = {
                db: {
                    getThreadByUserId: mock(() => Promise.resolve(thread)),
                },
                from: {
                    id: 12345,
                },
                message: {
                    message_id: 1,
                },
            } as unknown as ForwardContext;

            updateThreadByMessageMock.mockResolvedValue(thread);

            await requireThreadForUser(ctx, next);

            expect(ctx.db.getThreadByUserId).toHaveBeenCalledTimes(1);
            expect(ctx.db.getThreadByUserId).toHaveBeenCalledWith('12345');
            expect(updateThreadByMessageMock).toHaveBeenCalledTimes(1);
            expect(updateThreadByMessageMock).toHaveBeenCalledWith(ctx, thread, ctx.message);
            expect(next).toHaveBeenCalledTimes(1);
            expect(next).toHaveBeenCalledWith();
            expect(ctx.thread).toEqual(thread);
        });

        it('should create a new thread when an existing thread does not exist for the user', async () => {
            const ctx = {
                db: {
                    getThreadByUserId: mock(() => {}),
                },
                from: {
                    id: 12345,
                },
                message: {
                    message_id: 1,
                },
            } as unknown as ForwardContext;

            createNewThreadMock.mockResolvedValue({
                threadId: '99',
            });

            await requireThreadForUser(ctx, next);

            expect(ctx.db.getThreadByUserId).toHaveBeenCalledTimes(1);
            expect(ctx.db.getThreadByUserId).toHaveBeenCalledWith('12345');
            expect(createNewThreadMock).toHaveBeenCalledTimes(1);
            expect(createNewThreadMock).toHaveBeenCalledWith(ctx);
            expect(next).toHaveBeenCalledTimes(1);
            expect(next).toHaveBeenCalledWith();
            expect(ctx.thread).toEqual({ threadId: '99' });
        });

        it('should not proceed if there are any errors getting the thread', async () => {
            const ctx = {
                db: {
                    getThreadByUserId: mock(() => Promise.reject(new Error('Error getting thread'))),
                },
                from: {
                    id: 12345,
                },
                settings: {},
            } as unknown as ForwardContext;

            await requireThreadForUser(ctx, next);

            expect(createNewThreadMock).not.toHaveBeenCalled();
            expect(next).not.toHaveBeenCalled();
            expect(ctx.thread).toBeUndefined();
            expect(replyWithError).toHaveBeenCalledTimes(1);
        });

        it('should not proceed if there are any errors creating a new thread', async () => {
            const ctx = {
                db: {
                    getThreadByUserId: mock(() => {}),
                },
                from: {
                    id: 12345,
                },
                settings: { failure: 'F' },
            } as unknown as ForwardContext;

            createNewThreadMock.mockRejectedValue(new Error('Cannot create thread'));

            await requireThreadForUser(ctx, next);

            expect(next).not.toHaveBeenCalled();
            expect(replyWithError).toHaveBeenCalledTimes(1);
            expect(replyWithError).toHaveBeenCalledWith(ctx, 'F');
        });

        it('should not proceed if there are any errors updating a thread', async () => {
            const ctx = {
                db: {
                    getThreadByUserId: mock(() => Promise.resolve({ threadId: '11' })),
                },
                from: {
                    id: 12345,
                },
                settings: {},
            } as unknown as ForwardContext;

            updateThreadByMessageMock.mockRejectedValue(new Error('Cannot create thread'));

            await requireThreadForUser(ctx, next);

            expect(next).not.toHaveBeenCalled();
            expect(replyWithError).toHaveBeenCalledTimes(1);
        });
    });

    describe('requireReferencedThread', () => {
        it('should successfully set the thread for the message', async () => {
            const thread = { threadId: '11' };

            const ctx = {
                db: {
                    getThreadById: mock(() => Promise.resolve(thread)),
                },
                message: {
                    message_thread_id: 11,
                },
            } as unknown as ForwardContext;

            await requireReferencedThread(ctx, next);

            expect(ctx.thread).toEqual(thread);
            expect(next).toHaveBeenCalledTimes(1);
            expect(next).toHaveBeenCalledWith();
            expect(replyWithError).not.toHaveBeenCalled();
            expect(ctx.db.getThreadById).toHaveBeenCalledTimes(1);
            expect(ctx.db.getThreadById).toHaveBeenCalledWith('11');
        });

        it('should catch errors if thread cannot be found', async () => {
            const ctx = {
                db: {
                    getThreadById: mock(() => {}),
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
                    getThreadById: mock(() => Promise.reject(new Error('Cannot get thread'))),
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

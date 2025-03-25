import type { NextFunction } from '@/bot.js';
import type { ForwardContext } from '@/types/app.js';

import { DataService } from '@/services/types.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { injectDependencies, requireAdminReply, requirePrivateChat, requireSetup } from './common.js';

describe('common', () => {
    let next: NextFunction;

    beforeEach(() => {
        vi.clearAllMocks();
        next = vi.fn();
    });

    describe('requireSetup', () => {
        it('should not proceed if the setup was not completed', () => {
            requireSetup({} as unknown as ForwardContext, next);

            expect(next).not.toHaveBeenCalled();
        });

        it('should proceed if the setup was already completed', () => {
            requireSetup({ settings: { adminGroupId: '1' } } as unknown as ForwardContext, next);

            expect(next).toHaveBeenCalledExactlyOnceWith();
        });
    });

    describe('requirePrivateChat', () => {
        it.each(['group', 'supergroup'])('should not proceed if it is a %s', (type) => {
            requirePrivateChat({ chat: { type } } as unknown as ForwardContext, next);

            expect(next).not.toHaveBeenCalled();
        });

        it('should proceed if it is a private chat', () => {
            requirePrivateChat({ chat: { type: 'private' } } as unknown as ForwardContext, next);

            expect(next).toHaveBeenCalledExactlyOnceWith();
        });
    });

    describe('injectDependencies', () => {
        it('should proceed if we were able to inject the settings', async () => {
            const db = { getSettings: vi.fn().mockResolvedValue({ adminGroupId: '1' }) };
            const ctx = {} as unknown as ForwardContext;
            const fn = injectDependencies(db as unknown as DataService);

            await fn(ctx, next);

            expect(next).toHaveBeenCalledExactlyOnceWith();
            expect(ctx.db).toBe(db);
            expect(ctx.settings).toEqual({ adminGroupId: '1' });
        });

        it('should proceed even if we were not setup', async () => {
            const db = { getSettings: vi.fn() };
            const ctx = {} as unknown as ForwardContext;
            const fn = injectDependencies(db as unknown as DataService);

            await fn(ctx, next);

            expect(next).toHaveBeenCalledExactlyOnceWith();
            expect(ctx.db).toBe(db);
            expect(ctx.settings).toBeUndefined();
        });

        it('should fail if we could not query the settings', async () => {
            const db = { getSettings: vi.fn().mockRejectedValue(new Error('Cannot connect to db')) };
            const fn = injectDependencies(db as unknown as DataService);

            await fn({} as unknown as ForwardContext, next);

            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('requireAdminReply', () => {
        it('should accept a reply from the admin', () => {
            const ctx = {
                chat: { id: 1, type: 'supergroup' },
                message: { message_thread_id: 1, reply_to_message: {} },
                settings: { adminGroupId: '1' },
            } as unknown as ForwardContext;

            requireAdminReply(ctx, next);

            expect(next).toHaveBeenCalledExactlyOnceWith();
        });

        it('should not accept a DM from the user', () => {
            const ctx = {
                chat: { id: 1, type: 'private' },
                settings: { adminGroupId: '2' },
            } as unknown as ForwardContext;

            requireAdminReply(ctx, next);

            expect(next).not.toHaveBeenCalled();
        });

        it('should not proceed if it is an unknown message', () => {
            const ctx = {
                chat: { id: 1, type: 'group' },
                settings: { adminGroupId: '2' },
            } as unknown as ForwardContext;

            requireAdminReply(ctx, next);

            expect(next).not.toHaveBeenCalled();
        });
    });
});

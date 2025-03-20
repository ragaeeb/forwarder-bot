import type { ForwardContext } from '@/types.js';

import { describe, expect, it, vi } from 'vitest';

import { ignoreSelfMessages } from './middlewares.js';

describe('middlewares', () => {
    describe('ignoreSelfMessages', () => {
        it('should not proceed if the message is from the bot', () => {
            const next = vi.fn();
            const ctx = { from: { id: 1 }, me: { id: 1 } };
            ignoreSelfMessages(ctx as unknown as ForwardContext, next);

            expect(next).not.toHaveBeenCalled();
        });

        it('should proceed if the message is not from the bot', () => {
            const next = vi.fn();
            const ctx = { from: { id: 1 }, me: { id: 2 } };
            ignoreSelfMessages(ctx as unknown as ForwardContext, next);

            expect(next).toHaveBeenCalledExactlyOnceWith();
        });
    });
});

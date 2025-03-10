import { ForwardContext } from '@/types.js';
import { describe, expect, it, vi } from 'vitest';

import { onStart } from './start.js';

describe('start', () => {
    describe('onStart', () => {
        it('should reply to the message', async () => {
            const ctx: Partial<ForwardContext> = { reply: vi.fn() };

            await onStart(ctx as ForwardContext);

            expect(ctx.reply).toHaveBeenCalledOnce();
            expect(ctx.reply).toHaveBeenCalledWith(expect.any(String));
        });
    });
});

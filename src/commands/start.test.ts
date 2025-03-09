import { ForwardContext } from '@/types.js';
import { describe, expect, it, vi } from 'vitest';

import { onStart } from './start.js';

describe('start', () => {
    describe('onStart', () => {
        it('should to the message', async () => {
            const ctx = { reply: vi.fn() };

            await onStart(ctx as unknown as ForwardContext);

            expect(ctx.reply).toHaveBeenCalledOnce();
            expect(ctx.reply).toHaveBeenCalledWith(expect.any(String));
        });
    });
});

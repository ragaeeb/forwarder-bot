import { ForwardContext } from '@/types/app.js';
import { describe, expect, it, vi } from 'vitest';

import { onStart } from './start.js';

describe('start', () => {
    describe('onStart', () => {
        it('should reply to the message', async () => {
            const ctx = { reply: vi.fn(), settings: {} };

            await onStart(ctx as unknown as ForwardContext);

            expect(ctx.reply).toHaveBeenCalledOnce();
            expect(ctx.reply).toHaveBeenCalledWith(
                "👋 You can use this bot to communicate with our team. Simply send a message and it will be forwarded to us.\n\nWe'll reply to you through this same chat.",
            );
        });

        it('should reply to the custom greeting', async () => {
            const ctx = { reply: vi.fn(), settings: { greeting: 'G' } };

            await onStart(ctx as unknown as ForwardContext);

            expect(ctx.reply).toHaveBeenCalledOnce();
            expect(ctx.reply).toHaveBeenCalledWith('G');
        });
    });
});

import type { ForwardContext } from '@/types.js';

/**
 * Middleware to ignore messages sent by the bot itself.
 * Prevents the bot from responding to its own messages to avoid loops.
 *
 * @param {ForwardContext} ctx - The context object containing message information
 * @param {Function} next - The next middleware function to call if condition passes
 * @returns {Promise<void>}
 */
export const ignoreSelfMessages = async (ctx: ForwardContext, next: () => Promise<void>) => {
    if (ctx.from?.id !== ctx.me.id) {
        return next();
    }
};

import { ForwardContext } from '@/types.js';

export const withBot = async (ctx: ForwardContext, next: () => Promise<void>) => {
    const me = await ctx.api?.getMe();
    ctx.me = me;

    return next();
};

export const skipSelfMessages = async (ctx: ForwardContext, next: () => Promise<void>) => {
    if (ctx.from?.id !== ctx.me?.id) {
        return next();
    }
};

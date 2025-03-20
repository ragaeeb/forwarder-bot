import type { ForwardContext } from '@/types.js';

export const ignoreSelfMessages = async (ctx: ForwardContext, next: () => Promise<void>) => {
    if (ctx.from?.id !== ctx.me.id) {
        return next();
    }
};

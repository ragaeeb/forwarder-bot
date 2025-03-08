import type { ForwardContext } from '@/types.js';

export const onStart = async (ctx: ForwardContext) => {
    await ctx.reply(
        "👋 You can use this bot to communicate with our team. Simply send a message and it will be forwarded to us.\n\nWe'll reply to you through this same chat.",
    );
};

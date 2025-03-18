import type { ForwardContext } from '@/types.js';

import logger from '@/utils/logger.js';

export const onStart = async (ctx: ForwardContext) => {
    logger.info(ctx.chat, `onStart`);

    await ctx.reply(
        "👋 You can use this bot to communicate with our team. Simply send a message and it will be forwarded to us.\n\nWe'll reply to you through this same chat.",
    );
};

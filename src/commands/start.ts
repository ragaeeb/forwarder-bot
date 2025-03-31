import type { ForwardContext } from '@/types/app.js';

import logger from '@/utils/logger.js';
import { mapTelegramMessageToSavedMessage } from '@/utils/messageUtils.js';

/**
 * Handles the /start command when a user first interacts with the bot.
 * Sends a welcome message to the user, either custom or default.
 *
 * @param {ForwardContext} ctx - The context object containing command information
 * @returns {Promise<void>}
 */
export const onStart = async (ctx: ForwardContext) => {
    logger.info(ctx.chat, `onStart`);

    await ctx.db.saveMessage(mapTelegramMessageToSavedMessage(ctx.message!, 'user'));

    await ctx.reply(
        ctx.settings!.greeting ||
            "👋 You can use this bot to communicate with our team. Simply send a message and it will be forwarded to us.\n\nWe'll reply to you through this same chat.",
    );
};

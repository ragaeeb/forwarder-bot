import type { BotSettings, ForwardContext } from '@/types.js';

import logger from '@/utils/logger.js';
import { replyWithError, replyWithSuccess } from '@/utils/replyUtils.js';

/**
 * List of available customization commands that can be used to modify the bot's responses.
 */
export const CUSTOMIZE_COMMANDS = ['ack', 'failure', 'greeting'];

/**
 * Handles customization commands from administrators.
 * Allows changing the bot's greeting, acknowledgement, and failure messages.
 *
 * @param {ForwardContext} ctx - The context object containing information about the command
 * @returns {Promise<void>}
 */
export const onCustomize = async (ctx: ForwardContext) => {
    const [command, ...tokens] = ctx.text?.slice(1).split(' ') || [];

    logger.info(ctx.chat, `onCustomize: ${command}`);

    if (!CUSTOMIZE_COMMANDS.includes(command)) {
        logger.warn(`Invalid customize command received: ${command}`);
        await replyWithError(ctx, `Command ${command} not found.`);
        return;
    }

    try {
        const customizeCommand = command as keyof BotSettings;
        const result = await ctx.db.saveSettings({ ...ctx.settings, [customizeCommand]: tokens.join(' ') });
        await replyWithSuccess(ctx, `Saved ${command}=${result[customizeCommand]}`);
    } catch (err) {
        logger.error(err, 'Error saving customization setting');
        await replyWithError(ctx, `Error saving customization, please try again.`);
    }
};

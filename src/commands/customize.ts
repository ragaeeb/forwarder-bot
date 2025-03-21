import type { BotSettings, ForwardContext } from '@/types.js';

import logger from '@/utils/logger.js';
import { replyWithError, replyWithSuccess } from '@/utils/replyUtils.js';

export const CUSTOMIZE_COMMANDS = ['ack', 'failure', 'greeting'];

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

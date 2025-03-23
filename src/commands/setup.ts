import type { ForwardContext } from '@/types.js';

import logger from '@/utils/logger.js';
import { replyWithError, replyWithSuccess, replyWithWarning } from '@/utils/replyUtils.js';

/**
 * Checks if the bot was already configured and handles changing the admin group.
 *
 * @param {ForwardContext} ctx - The context object containing chat information
 * @returns {Promise<void>}
 */
const notifyAndLeavePreviousGroup = async (ctx: ForwardContext) => {
    if (ctx.settings) {
        const { adminGroupId } = ctx.settings;

        try {
            // best effort
            logger.info(`Sending a notification to previous group of deactivation`);
            await replyWithWarning(ctx, `Bot is being reconfigured, deactivating forwards to this group.`);

            logger.info(`Leaving chat=${adminGroupId}`);
            await ctx.bot.api.leaveChat({ chat_id: adminGroupId });

            logger.info(`Left old group`);
        } catch (err) {
            logger.error(err, `Failed to notify previous group of reconfiguration`);
        }
    }
};

/**
 * Handles the /setup command to configure the bot with an admin group.
 *
 * @param {ForwardContext} ctx - The context object containing command information
 * @returns {Promise<void>}
 */
export const onSetup = async (ctx: ForwardContext) => {
    logger.info(`onSetup`);

    try {
        await notifyAndLeavePreviousGroup(ctx);

        // Store group as the forwarding destination
        await ctx.db.saveSettings({
            adminGroupId: ctx.chat.id.toString(),
            configId: 'main',
            setupAt: new Date().toISOString(),
            setupBy: ctx.from,
        });

        logger.info(`Replying successful setup to user.`);

        await replyWithSuccess(
            ctx,
            `Setup complete! Group ${ctx.chat.id} is now set as the contact inbox.\n\n⚠️ It is recommended that you delete the setup message for security purposes.`,
        );
    } catch (error) {
        logger.error(error, `Setup failed`);

        await replyWithError(ctx, 'Setup failed. Please try again.');
    }
};

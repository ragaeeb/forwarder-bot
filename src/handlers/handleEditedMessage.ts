import type { ForwardContext } from '@/types.js';

import logger from '@/utils/logger.js';
import { mapTelegramMessageToSavedMessage } from '@/utils/messageUtils.js';

/**
 * Handles when a user edits a message they previously sent to the bot.
 * Forwards the edited message to the admin group and saves the update.
 *
 * @param {ForwardContext} ctx - The context object containing edited message information
 * @returns {Promise<void>}
 */
export const onEditedMessage = async (ctx: ForwardContext) => {
    logger.info(`handleEditedMessage`);

    try {
        const threadData = await ctx.db.getThreadByUserId(ctx.from.id.toString());

        if (!threadData) {
            logger.warn(`Received edited message but no thread exists for user ${ctx.from.id}`);
            return;
        }

        const threadId = parseInt(threadData.threadId);
        const { adminGroupId } = ctx.settings;

        logger.info(`Notifying of edited message to group ${adminGroupId}/${threadId}`);

        await ctx.bot.api.sendMessage({
            chat_id: adminGroupId,
            message_thread_id: threadId,
            text: `✏️ Message Edit Notification`,
        });

        logger.info(`Forwarding new message from ${ctx.chat.id} to ${adminGroupId}/${threadId}`);

        const originalMessageId = ctx.message!.message_id;

        await ctx.bot.api.forwardMessage({
            chat_id: adminGroupId,
            from_chat_id: ctx.chat.id,
            message_id: originalMessageId,
            message_thread_id: threadId,
        });

        logger.info(`Saving edited message to database ${originalMessageId}`);

        const result = await ctx.db.saveMessage({
            ...mapTelegramMessageToSavedMessage(ctx.message!, 'user'),
            id: `${originalMessageId}_edited_${Date.now()}`,
            originalMessageId: originalMessageId.toString(),
        });

        logger.info(`Saved edited message with id=${result.id}`);
    } catch (error) {
        logger.error(error, `Error handling edited message`);
    }
};

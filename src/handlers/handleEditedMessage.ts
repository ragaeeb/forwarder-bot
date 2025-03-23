import type { ForwardContext } from '@/types.js';

import logger from '@/utils/logger.js';
import { mapTelegramMessageToSavedMessage } from '@/utils/messageUtils.js';

import type { TelegramMessage } from '../types/telegram.js';

/**
 * Handles when a user edits a message they previously sent to the bot.
 * Forwards the edited message to the admin group and saves the update.
 *
 * @param {ForwardContext} ctx - The context object containing edited message information
 * @returns {Promise<void>}
 */
export const handleEditedMessage = async (ctx: ForwardContext) => {
    logger.info(ctx.chat, `handleEditedMessage`);

    if (ctx.chat?.type !== 'private') {
        logger.info(`Skipping non-DM edited message`);
        return;
    }

    try {
        const userId = ctx.from?.id.toString() as string;

        logger.info(`Looking up thread for user=${userId}`);
        const threadData = await ctx.db.getThreadByUserId(userId);
        logger.info(threadData, `Thread for user ${userId}`);

        if (!threadData) {
            logger.warn(`Received edited message but no thread exists for user ${userId}`);
            return;
        }

        const threadId = parseInt(threadData.threadId);

        logger.info(`Notifying of edited message to group`);

        const { adminGroupId } = ctx.settings;

        await ctx.api.sendMessage({
            chat_id: adminGroupId,
            message_thread_id: threadId,
            text: `🔄 Message Edit Notification`,
        });

        logger.info(`Forwarding new message`);

        await ctx.api.forwardMessage({
            chat_id: adminGroupId,
            from_chat_id: ctx.chatId as number | string,
            message_id: ctx.update?.edited_message?.message_id as number,
            message_thread_id: threadId,
        });

        const originalMessageId = ctx.update?.edited_message?.message_id.toString();

        logger.info(`Saving edited message to database ${originalMessageId}`);

        const result = await ctx.db.saveMessage({
            ...mapTelegramMessageToSavedMessage(ctx.update?.edited_message as TelegramMessage, 'user'),
            id: `${originalMessageId}_edited_${Date.now()}`,
            originalMessageId,
        });

        logger.info(`Saved edited message with id=${result.id}`);
    } catch (error) {
        logger.error(error, `Error handling edited message`);
    }
};

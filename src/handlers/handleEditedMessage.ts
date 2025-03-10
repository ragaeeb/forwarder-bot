import type { ForwardContext } from '@/types.js';

import logger from '@/utils/logger.js';
import { mapTelegramMessageToSavedMessage } from '@/utils/messageUtils.js';
import { TelegramMessage } from 'gramio';

export const handleEditedMessage = async (ctx: ForwardContext) => {
    logger.info(`handleEditedMessage`);

    if (ctx.chat?.type !== 'private') {
        logger.info(`Skipping non-DM edited message`);
        return;
    }

    const adminGroupId = (await ctx.db.getConfig())?.adminGroupId;

    if (!adminGroupId) {
        logger.warn(`Setup not yet completed.`);
        return;
    }

    try {
        // Find the user's thread
        const threadData = await ctx.db.getThreadByUserId(ctx.from?.id.toString() as string);
        logger.info(`Thread for user ${ctx.from?.id} is ${JSON.stringify(threadData)}`);

        if (!threadData) {
            logger.warn(`Received edited message but no thread exists for user ${ctx.from?.id}`);
            return;
        }

        const threadId = parseInt(threadData.threadId);

        logger.info(`Notifying of edited message to group`);

        await ctx.bot.api.sendMessage({
            chat_id: adminGroupId,
            message_thread_id: threadId,
            text: `🔄 Message Edit Notification`,
        });

        logger.info(`Forwarding new message`);

        await ctx.bot.api.forwardMessage({
            chat_id: adminGroupId,
            from_chat_id: ctx.chatId,
            message_id: ctx.update?.edited_message?.message_id as number,
            message_thread_id: threadId,
        });

        const originalMessageId = ctx.update?.edited_message?.message_id.toString();

        logger.info(`Saving edited message to database ${originalMessageId}`);

        await ctx.db.saveMessage({
            ...mapTelegramMessageToSavedMessage(ctx.update?.edited_message as TelegramMessage, 'user'),
            id: `${originalMessageId}_edited_${Date.now()}`,
            originalMessageId,
        });

        logger.info(`Saved edited message`);
    } catch (error) {
        logger.error(error, `Error handling edited message`);
    }
};

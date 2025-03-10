import type { ForwardContext } from '@/types.js';

import logger from '@/utils/logger.js';
import { mapTelegramMessageToSavedMessage } from '@/utils/messageUtils.js';
import { replyWithSuccess } from '@/utils/replyUtils.js';
import { createNewThread, getUpsertedThread } from '@/utils/threadUtils.js';
import { TelegramMessage } from 'gramio';

const forwardMessageToGroup = async (ctx: ForwardContext, groupId: string, threadId: string) => {
    logger.info(`forwardMessageToGroup threadId=${threadId}`);
    await ctx.bot.api.forwardMessage({
        chat_id: groupId,
        from_chat_id: ctx.chatId,
        message_id: ctx.id,
        message_thread_id: parseInt(threadId),
    });

    logger.info(`forward successful`);

    return replyWithSuccess(ctx, `Message delivered, our team will get back to you in shāʾ Allah.`);
};

const retryFailedForward = async (ctx: ForwardContext, adminGroupId: string) => {
    try {
        logger.info(`retryFailedForward: ${adminGroupId}`);
        const threadData = await createNewThread(ctx, adminGroupId);
        logger.info(`thread created: ${JSON.stringify(threadData)}`);

        if (threadData) {
            return forwardMessageToGroup(ctx, adminGroupId, threadData.threadId); // try again
        }
    } catch (retryError) {
        logger.error({ error: retryError, userId: ctx.from?.id }, 'Failed to forward message after retry');
    }
};

export const handleDirectMessage = async (ctx: ForwardContext, adminGroupId: string) => {
    logger.info(`handleDirectMessage`);
    const threadData = await getUpsertedThread(ctx, adminGroupId);

    if (threadData) {
        logger.info(`save message to db`);
        await ctx.db.saveMessage(mapTelegramMessageToSavedMessage(ctx.update?.message as TelegramMessage, 'user'));

        try {
            logger.info(`message saved now forwarding to group`);
            const result = await forwardMessageToGroup(ctx, adminGroupId, threadData.threadId);

            if (result) {
                return result;
            }
        } catch (error: any) {
            logger.error({ error, userId: ctx.from?.id }, 'Failed to forward message');

            if ((error.message || String(error)).includes('message thread not found')) {
                // Check may have been deleted by admin
                return retryFailedForward(ctx, adminGroupId);
            }
        }
    }
};

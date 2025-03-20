import type { ForwardContext } from '@/types.js';
import type { TelegramMessage } from 'gramio';

import logger from '@/utils/logger.js';
import { mapTelegramMessageToSavedMessage } from '@/utils/messageUtils.js';
import { replyWithError, replyWithSuccess } from '@/utils/replyUtils.js';
import { createNewThread, getUpsertedThread } from '@/utils/threadUtils.js';

const forwardMessageToGroup = async (ctx: ForwardContext, groupId: string, threadId: string) => {
    logger.info(
        `forwardMessageToGroup threadId=${threadId}, chatId=${groupId} from=${ctx.chatId}, messageId=${ctx.id}`,
    );
    await ctx.bot.api.forwardMessage({
        chat_id: groupId,
        from_chat_id: ctx.chatId,
        message_id: ctx.id,
        message_thread_id: parseInt(threadId),
    });

    logger.info(`Replying 200 to user for successful forwarding.`);

    return replyWithSuccess(ctx, ctx.settings.ack || 'Message delivered, our team will get back to you.');
};

const retryFailedForward = async (ctx: ForwardContext, adminGroupId: string) => {
    try {
        logger.info(`retryFailedForward: ${adminGroupId}, creating a new thread.`);
        const threadData = await createNewThread(ctx, adminGroupId);
        logger.info(threadData, `Thread created`);

        if (threadData) {
            return forwardMessageToGroup(ctx, adminGroupId, threadData.threadId); // try again
        }
    } catch (retryError) {
        logger.error({ error: retryError, userId: ctx.from?.id }, 'Failed to forward message after retry');
        return replyWithError(ctx, ctx.settings.failure || 'Could not deliver message, please try again later.');
    }
};

export const handleDirectMessage = async (ctx: ForwardContext, adminGroupId: string) => {
    logger.info(`handleDirectMessage`);

    const threadData = await getUpsertedThread(ctx, adminGroupId);

    if (threadData) {
        logger.info(`Saving message to database`);
        await ctx.db.saveMessage(mapTelegramMessageToSavedMessage(ctx.update?.message as TelegramMessage, 'user'));

        try {
            logger.info(`Forwarding DM from user to admin group`);
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

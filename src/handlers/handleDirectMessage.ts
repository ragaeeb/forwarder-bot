import type { ForwardContext } from '@/types.js';

import logger from '@/utils/logger.js';
import { mapTelegramMessageToSavedMessage } from '@/utils/messageUtils.js';
import { replyWithSuccess } from '@/utils/replyUtils.js';
import { createNewThread, getUpsertedThread } from '@/utils/threadUtils.js';
import { TelegramMessage } from 'gramio';

const forwardMessageToGroup = async (ctx: ForwardContext, groupId: string, threadId: number) => {
    console.log('forwardMessageToGroup');
    await ctx.api.forwardMessage({
        chat_id: groupId,
        from_chat_id: ctx.chatId,
        message_id: ctx.id,
        message_thread_id: threadId,
    });

    return replyWithSuccess(ctx, `Message delivered, our team will get back to you in shāʾ Allah.`);
};

const retryFailedForward = async (ctx: ForwardContext, adminGroupId: string) => {
    try {
        const threadData = await createNewThread(ctx, adminGroupId);

        if (threadData) {
            return forwardMessageToGroup(ctx, adminGroupId, threadData.threadId); // try again
        }
    } catch (retryError) {
        logger.error('Failed to forward message after retry', { error: retryError, userId: ctx.from?.id });
    }
};

export const handleDirectMessage = async (ctx: ForwardContext, adminGroupId: string) => {
    const threadData = await getUpsertedThread(ctx, adminGroupId);

    if (threadData) {
        await ctx.db.saveMessage(mapTelegramMessageToSavedMessage(ctx.update?.message as TelegramMessage, 'user'));

        try {
            const result = await forwardMessageToGroup(ctx, adminGroupId, threadData.threadId);

            if (result) {
                return result;
            }
        } catch (error: any) {
            logger.error('Failed to forward message', { error, userId: ctx.from?.id });

            if ((error.message || String(error)).includes('message thread not found')) {
                // Check may have been deleted by admin
                return retryFailedForward(ctx, adminGroupId);
            }
        }
    }
};

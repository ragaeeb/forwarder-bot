import type { ForwardContext } from '@/types/app.js';

import logger from '@/utils/logger.js';
import { mapTelegramMessageToSavedMessage } from '@/utils/messageUtils.js';
import { replyWithError, replyWithSuccess } from '@/utils/replyUtils.js';
import { createNewThread } from '@/utils/threadUtils.js';

/**
 * Forwards a user's message to the admin group in the appropriate thread.
 * Sends acknowledgment message to the user upon successful forwarding.
 *
 * @param {ForwardContext} ctx - The context object containing user message information
 * @param {string} groupId - The admin group ID to forward the message to
 * @param {string} threadId - The topic thread ID to use in the admin group
 * @returns {Promise<any>} The result of the acknowledgment operation
 */
const forwardMessageToGroup = async (ctx: ForwardContext, threadId: string) => {
    logger.info(
        `forwardMessageToGroup ${ctx.settings!.adminGroupId}/${threadId} from=${ctx.chat.id}/${ctx.message!.message_id}`,
    );
    const message = await ctx.bot.api.forwardMessage({
        chat_id: ctx.settings!.adminGroupId,
        from_chat_id: ctx.chat.id,
        message_id: ctx.message!.message_id,
        message_thread_id: parseInt(threadId),
    });

    logger.info(`Replying 200 to user for successful forwarding of ${message.message_id}.`);

    await replyWithSuccess(ctx, ctx.settings!.ack || 'Message delivered, our team will get back to you.');
};

/**
 * Handles a direct message from a user to the bot.
 * Gets or creates a thread for the user and forwards the message to the admin group.
 *
 * @param {ForwardContext} ctx - The context object containing user message information
 * @returns {Promise<any|undefined>} The result of the forwarding operation or undefined
 */
export const onDirectMessage = async (ctx: ForwardContext) => {
    logger.info(`onDirectMessage`);

    try {
        logger.info(`Saving message to database`);

        await ctx.db.saveMessage(mapTelegramMessageToSavedMessage(ctx.message!, 'user'));

        logger.info(`Forwarding DM from user to admin group`);

        try {
            await forwardMessageToGroup(ctx, ctx.thread!.threadId);
        } catch (error: any) {
            if ((error.message || String(error)).includes('message thread not found')) {
                logger.warn(`Could not forward message, retrying by creating a new thread.`);
                const threadData = await createNewThread(ctx);
                logger.info(threadData, `Thread created`);

                await forwardMessageToGroup(ctx, threadData.threadId); // try again
                logger.info('Successfully sent message on second attempt.');
            } else {
                throw error;
            }
        }
    } catch (error: any) {
        logger.error(error, 'Failed to forward message');
        await replyWithError(ctx, ctx.settings!.failure || 'Could not deliver message, please try again later.');
    }
};

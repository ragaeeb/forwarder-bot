import type { NextFunction } from '@/bot.js';
import type { ForwardContext } from '@/types/app.js';

import logger from '@/utils/logger.js';
import { replyWithError } from '@/utils/replyUtils.js';
import { createNewThread, updateThreadByMessage } from '@/utils/threadUtils.js';

/**
 * Validates that the bot has the necessary permissions in the chat.
 * Tests creating and deleting a topic to ensure the bot has admin rights.
 * @returns {Function} Middleware function
 */
export const requireReferencedThread = async (ctx: ForwardContext, next: NextFunction) => {
    const threadId = ctx.message!.message_thread_id!.toString();

    logger.info(`requireReferencedThread ${threadId}`);

    try {
        ctx.thread = await ctx.db.getThreadById(threadId);

        if (ctx.thread) {
            return next();
        }

        logger.error({ threadId }, 'Thread data not found');
        await replyWithError(ctx, 'Could not find the thread data for this user.');
    } catch (err) {
        logger.error(err, `Error looking up thread ${threadId}.`);
        await replyWithError(ctx, 'Error looking up message thread.');
    }
};

/**
 * Gets an existing thread for a user or creates a new one if none exists.
 * Also updates the thread with the latest message information.
 *
 * @param {ForwardContext} ctx - The context object with user and message information
 * @returns {Promise<ThreadData|undefined>} The thread data or undefined on error
 */
export const requireThreadForUser = async (ctx: ForwardContext, next: NextFunction) => {
    logger.info(`requireThreadForUser`);

    try {
        const threadData = await ctx.db.getThreadByUserId(ctx.from.id.toString());
        logger.debug(threadData, `Thread for user ${ctx.from.id}`);

        if (threadData) {
            logger.info(`Update thread with associated message`);

            ctx.thread = await updateThreadByMessage(ctx, threadData, ctx.message!);
        } else {
            logger.info('Thread does not exist for user, create new thread...');
            ctx.thread = await createNewThread(ctx);
        }

        return next();
    } catch (err) {
        logger.error(err, 'Error getting thread for user');
        await replyWithError(ctx, ctx.settings?.failure || 'Could not send message, please try again later.');
    }
};

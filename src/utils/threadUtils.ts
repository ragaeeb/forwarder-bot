import type { ForwardContext, ThreadData } from '@/types.js';
import type { TelegramMessage, TelegramUser } from '@/types/telegram.js';

import logger from './logger.js';

/**
 * Generates a human-readable name for a thread based on user information.
 * Format: "userId: firstName lastName (username)"
 *
 * @param {User} user - Telegram user information
 * @returns {string} A formatted string for the thread name
 */
const mapUserToThreadName = (user: TelegramUser) => {
    const label = [user.first_name, user.last_name, user.username && `(${user.username})`].filter(Boolean).join(' ');
    return [user.id, label].filter(Boolean).join(': ');
};

/**
 * Creates a new topic thread in the admin group for a user.
 * Initializes a thread record in the database with metadata.
 *
 * @param {ForwardContext} ctx - The context object with user information
 * @param {string} groupId - The admin group ID to create the thread in
 * @returns {Promise<ThreadData|undefined>} The created thread data or undefined on error
 */
export const createNewThread = async (ctx: ForwardContext) => {
    try {
        logger.info(`Creating new thread in ${ctx.settings.adminGroupId} with name=${mapUserToThreadName(ctx.from)}`);
        const response = await ctx.bot.api.createForumTopic({
            chat_id: ctx.settings.adminGroupId,
            name: mapUserToThreadName(ctx.from),
        });

        logger.info(response, `Thread created, saving thread`);

        return ctx.db.saveThread({
            chatId: ctx.chat!.id.toString(),
            createdAt: new Date((ctx.message?.date as number) * 1000).toISOString(),
            lastMessageId: ctx.message?.message_id.toString() as string,
            name: response.name,
            threadId: response.message_thread_id.toString(),
            updatedAt: new Date().toISOString(),
            userId: ctx.from?.id.toString() as string,
        });
    } catch (error) {
        logger.error(error, 'Failed to create thread');
        throw error;
    }
};

/**
 * Updates an existing thread with information from a new message.
 * Updates the lastMessageId and updatedAt timestamp.
 *
 * @param {ForwardContext} ctx - The context object with database access
 * @param {ThreadData} threadData - The existing thread data to update
 * @param {TelegramMessage} message - The new message to update with
 * @returns {Promise<ThreadData>} The updated thread data
 */
export const updateThreadByMessage = (ctx: ForwardContext, threadData: ThreadData, message: TelegramMessage) => {
    logger.debug(threadData, `updateThreadByMessage`);

    return ctx.db.saveThread({
        ...threadData,
        lastMessageId: message.message_id.toString(),
        updatedAt: new Date().toISOString(),
    });
};

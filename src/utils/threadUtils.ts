import type { ForwardContext, ThreadData } from '@/types.js';

import type { TelegramMessage } from '../types/telegram.js';

import logger from './logger.js';

// Define a simplified User interface for this function
interface User {
    firstName?: string;
    id: number;
    lastName?: string;
    username?: string;
}

/**
 * Generates a human-readable name for a thread based on user information.
 * Format: "userId: firstName lastName (username)"
 *
 * @param {User} user - Telegram user information
 * @returns {string} A formatted string for the thread name
 */
const mapUserToThreadName = ({ firstName, id, lastName, username }: User) => {
    const label = [firstName, lastName, username && `(${username})`].filter(Boolean).join(' ');
    return [id, label].filter(Boolean).join(': ');
};

/**
 * Creates a new topic thread in the admin group for a user.
 * Initializes a thread record in the database with metadata.
 *
 * @param {ForwardContext} ctx - The context object with user information
 * @param {string} groupId - The admin group ID to create the thread in
 * @returns {Promise<ThreadData|undefined>} The created thread data or undefined on error
 */
export const createNewThread = async (ctx: ForwardContext, groupId: string) => {
    try {
        const user = {
            firstName: ctx.from?.first_name,
            id: ctx.from?.id as number,
            lastName: ctx.from?.last_name,
            username: ctx.from?.username,
        };

        logger.info(`Creating new thread in ${groupId} with name=${mapUserToThreadName(user)}`);
        const response = await ctx.api.createForumTopic({
            chat_id: groupId,
            name: mapUserToThreadName(user),
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
    return ctx.db.saveThread({
        ...threadData,
        lastMessageId: message.message_id.toString() as string,
        updatedAt: new Date().toISOString(),
    });
};

/**
 * Gets an existing thread for a user or creates a new one if none exists.
 * Also updates the thread with the latest message information.
 *
 * @param {ForwardContext} ctx - The context object with user and message information
 * @param {string} adminGroupId - The admin group ID to create a thread in if needed
 * @returns {Promise<ThreadData|undefined>} The thread data or undefined on error
 */
export const getUpsertedThread = async (ctx: ForwardContext, adminGroupId: string) => {
    const threadData = await ctx.db.getThreadByUserId(ctx.from?.id.toString() as string);
    logger.info(`Thread for user ${ctx.from?.id} is ${JSON.stringify(threadData)}`);

    if (threadData) {
        logger.info(`Update thread with associated message`);
        const user = {
            firstName: ctx.from?.first_name,
            id: ctx.from?.id as number,
            lastName: ctx.from?.last_name,
            username: ctx.from?.username,
        };
        return updateThreadByMessage(
            ctx,
            { ...threadData, name: mapUserToThreadName(user) },
            ctx.message as TelegramMessage,
        );
    }

    return createNewThread(ctx, adminGroupId);
};

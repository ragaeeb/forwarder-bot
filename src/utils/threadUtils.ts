import type { ForwardContext, ThreadData } from '@/types.js';
import type { TelegramMessage, User } from 'gramio';

import logger from './logger.js';

const mapUserToThreadName = ({ firstName, id, lastName, username }: User) => {
    const label = [firstName, lastName, username && `(${username})`].filter(Boolean).join(' ');
    return [id, label].filter(Boolean).join(': ');
};

export const createNewThread = async (ctx: ForwardContext, groupId: string) => {
    try {
        logger.info(`Creating new thread in ${groupId} with name=${mapUserToThreadName(ctx.from as User)}`);
        const response = await ctx.bot.api.createForumTopic({
            chat_id: groupId,
            name: mapUserToThreadName(ctx.from as User),
        });

        logger.info(response, `Thread created, saving thread`);

        return ctx.db.saveThread({
            chatId: ctx.chat.id.toString(),
            createdAt: new Date((ctx.update?.message?.date as number) * 1000).toISOString(),
            lastMessageId: ctx.update?.message?.message_id.toString() as string,
            name: response.name,
            threadId: response.message_thread_id.toString(),
            updatedAt: new Date().toISOString(),
            userId: ctx.from?.id.toString() as string,
        });
    } catch (error) {
        logger.error(error, 'Failed to create thread');
    }
};

export const updateThreadByMessage = (ctx: ForwardContext, threadData: ThreadData, message: TelegramMessage) => {
    return ctx.db.saveThread({
        ...threadData,
        lastMessageId: message.message_id.toString() as string,
        updatedAt: new Date().toISOString(),
    });
};

export const getUpsertedThread = async (ctx: ForwardContext, adminGroupId: string) => {
    const threadData = await ctx.db.getThreadByUserId(ctx.from?.id.toString() as string);
    logger.info(`Thread for user ${ctx.from?.id} is ${JSON.stringify(threadData)}`);

    if (threadData) {
        logger.info(`Update thread with associated message`);
        return updateThreadByMessage(
            ctx,
            { ...threadData, name: mapUserToThreadName(ctx.from as User) },
            ctx.update?.message as TelegramMessage,
        );
    }

    return createNewThread(ctx, adminGroupId);
};

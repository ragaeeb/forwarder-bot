import type { NextFunction } from '@/bot.js';
import type { ForwardContext } from '@/types/app.js';

import { TelegramForumTopic } from '@/types/telegram.js';
import logger from '@/utils/logger.js';
import { replyWithError } from '@/utils/replyUtils.js';

/**
 * Validates that the bot has the necessary permissions in the chat.
 * Tests creating and deleting a topic to ensure the bot has admin rights.
 * @returns {Function} Middleware function
 */
export const requireManageTopicsPermission = async (ctx: ForwardContext, next: NextFunction) => {
    const {
        bot: { api },
        chat: { id: chatId },
    } = ctx;

    logger.info(`requireManageTopicsPermission`);

    try {
        const testTopic = (await api.createForumTopic({
            chat_id: chatId,
            name: 'Test Topic Permissions',
        })) as TelegramForumTopic;

        logger.info(testTopic, `Testing delete thread, and fetch existing config`);

        await api.deleteForumTopic({
            chat_id: chatId,
            message_thread_id: testTopic.message_thread_id,
        });
    } catch (err) {
        logger.error(err, `Error managing thread.`);

        await replyWithError(
            ctx,
            'Setup failed. Please ensure topics are enabled and the bot has privileges to Manage Topics.',
        );

        return;
    }

    logger.info(`Thread management checks passed.`);
    await next();
};

import type { ForwardContext } from '@/types.js';

import logger from '@/utils/logger.js';
import { replyWithError } from '@/utils/replyUtils.js';

import { handleAdminReplyToCustomer } from './handleAdminReply.js';
import { handleDirectMessage } from './handleDirectMessage.js';

export const onGenericMessage = async (ctx: ForwardContext) => {
    logger.info(ctx.update, `onGenericMessage`);

    const message = ctx.update?.message;

    if (!message) {
        logger.warn(`No message found.`);
        return;
    }

    const { adminGroupId } = ctx.settings;
    const chatId = ctx.chat?.id.toString();

    const isAdminReply =
        chatId === adminGroupId &&
        ctx.chat.type === 'supergroup' &&
        message.reply_to_message &&
        message.message_thread_id;

    if (isAdminReply) {
        // an admin replied to a user
        const result = await handleAdminReplyToCustomer(ctx);

        if (!result) {
            await replyWithError(ctx, 'Unable to send message, please try again.');
        }
    }

    const isDirectMessage = ctx.chat.type === 'private' && chatId !== adminGroupId;

    // Handle direct messages (if not from the contact group)
    if (isDirectMessage) {
        // user sent a DM to the bot
        const result = await handleDirectMessage(ctx, adminGroupId);

        if (!result) {
            await replyWithError(ctx, ctx.settings.failure || 'Unable to send message, please try again.');
        }
    }
};

import type { ForwardContext } from '@/types.js';

import logger from '@/utils/logger.js';
import { replyWithUnknownError } from '@/utils/replyUtils.js';

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
            await replyWithUnknownError(ctx);
        }
    }

    const isDirectMessage = ctx.chat.type === 'private' && chatId !== adminGroupId;

    // Handle direct messages (if not from the contact group)
    if (isDirectMessage) {
        // user sent a DM to the bot
        const result = await handleDirectMessage(ctx, adminGroupId);

        if (!result) {
            await replyWithUnknownError(ctx);
        }
    }
};

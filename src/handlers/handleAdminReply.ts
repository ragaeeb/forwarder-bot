import type { ForwardContext } from '@/types.js';
import type { APIMethods, SuppressedAPIMethods, TelegramMessage } from 'gramio';

import logger from '@/utils/logger.js';
import { mapTelegramMessageToSavedMessage } from '@/utils/messageUtils.js';
import { replyWithError, replyWithSuccess } from '@/utils/replyUtils.js';
import { updateThreadByMessage } from '@/utils/threadUtils.js';

/*
 * Forwards a message from an admin to a user based on the message type.
 * Currently supports text, photo, and document message types.
 *
 * @param api - The Telegram API methods to use for sending
 * @param chatId - The destination chat ID to send to
 * @param message - The Telegram message to forward
 * @returns The sent message response or null/undefined for unsupported types
 */
const forwardMessageToUser = async (
    api: SuppressedAPIMethods<keyof APIMethods>,
    chatId: string,
    message: TelegramMessage,
) => {
    if (message.text) {
        logger.info(`Forwarding text message for chat=${chatId}`);
        return api.sendMessage({
            chat_id: chatId,
            text: message.text,
        });
    }

    if (message.photo) {
        logger.info(`Forwarding photo for chat=${chatId}`);
        const photo = message.photo[message.photo.length - 1];

        return api.sendPhoto({
            caption: message.caption,
            chat_id: chatId,
            photo: photo.file_id,
        });
    }

    if (message.document) {
        logger.info(`Forwarding document for chat=${chatId}`);

        return api.sendDocument({
            caption: message.caption,
            chat_id: chatId,
            document: message.document.file_id,
        });
    }
};

export const handleAdminReplyToCustomer = async (ctx: ForwardContext) => {
    const threadId = ctx.update?.message?.message_thread_id?.toString() as string;
    logger.info(`handleAdminReplyToCustomer: ${threadId}`);

    const thread = await ctx.db.getThreadById(threadId);

    if (!thread) {
        logger.warn('Thread data not found', { threadId });
        return replyWithError(ctx, 'Could not find the thread data for this user.');
    }

    logger.info(`Forwarding message from admin to user`);
    const sentMessage = await forwardMessageToUser(ctx.bot.api, thread.chatId, ctx.update?.message as TelegramMessage);

    if (!sentMessage) {
        logger.warn('Unsupported message type', { message: ctx.update?.message });
        return replyWithError(ctx, 'Unsupported message type. Please send text, photo, or document.');
    }

    logger.info(`Saving message to database`);

    await ctx.db.saveMessage(
        mapTelegramMessageToSavedMessage(
            {
                ...ctx.update?.message,
                message_id: sentMessage.message_id,
                reply_to_message: sentMessage.reply_to_message,
            } as TelegramMessage,
            'admin',
        ),
    );

    logger.info(`Updating thread associated with message`);
    await updateThreadByMessage(ctx, thread, sentMessage);

    logger.info(`Sending success to user`);
    return replyWithSuccess(ctx, `Reply sent to user`);
};

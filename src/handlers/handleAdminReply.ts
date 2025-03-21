import type { ForwardContext } from '@/types.js';
import type { APIMethods, SuppressedAPIMethods, TelegramMessage } from 'gramio';

import logger from '@/utils/logger.js';
import { mapTelegramMessageToSavedMessage } from '@/utils/messageUtils.js';
import { replyWithError, replyWithSuccess } from '@/utils/replyUtils.js';
import { updateThreadByMessage } from '@/utils/threadUtils.js';

/**
 * Forwards a message from an admin to a user based on the message type.
 * Currently supports text, photo, and document message types.
 *
 * @param {SuppressedAPIMethods<keyof APIMethods>} api - The Telegram API methods to use for sending
 * @param {string} chatId - The destination chat ID to send to
 * @param {TelegramMessage} message - The Telegram message to forward
 * @returns {Promise<TelegramMessage|undefined>} The sent message response or undefined for unsupported types
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
            protect_content: true,
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
            protect_content: true,
        });
    }

    if (message.document) {
        logger.info(`Forwarding document for chat=${chatId}`);

        return api.sendDocument({
            caption: message.caption,
            chat_id: chatId,
            document: message.document.file_id,
            protect_content: true,
        });
    }

    if (message.voice) {
        logger.info(`Forwarding voice note for chat=${chatId}`);

        return api.sendVoice({
            caption: message.caption,
            chat_id: chatId,
            protect_content: true,
            voice: message.voice.file_id,
        });
    }

    if (message.video) {
        logger.info(`Forwarding video for chat=${chatId}`);

        return api.sendVideo({
            caption: message.caption,
            chat_id: chatId,
            protect_content: true,
            video: message.video.file_id,
        });
    }
};

/**
 * Handles an admin's reply to a customer message.
 * Identifies the thread, forwards the response, and updates the database.
 *
 * @param {ForwardContext} ctx - The context object containing admin reply information
 * @returns {Promise<any>} The result of the operation
 */
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

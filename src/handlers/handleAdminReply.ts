import type { ForwardContext } from '@/types/app.js';

import logger from '@/utils/logger.js';
import { mapTelegramMessageToSavedMessage } from '@/utils/messageUtils.js';
import { replyWithError, replyWithSuccess } from '@/utils/replyUtils.js';
import { updateThreadByMessage } from '@/utils/threadUtils.js';

import type { TelegramMessage } from '../types/telegram.js';

/**
 * Forwards a message from an admin to a user based on the message type.
 * Currently supports text, photo, and document message types.
 *
 * @param {TelegramAPI} api - The Telegram API methods to use for sending
 * @param {string} chatId - The destination chat ID to send to
 * @param {TelegramMessage} message - The Telegram message to forward
 * @returns {Promise<TelegramMessage|undefined>} The sent message response or undefined for unsupported types
 */
const forwardMessageToUser = async (ctx: ForwardContext) => {
    const message = ctx.message!;
    const { chatId } = ctx.thread!;

    const commonMessage = {
        chat_id: parseInt(chatId),
        protect_content: true,
    };

    if (message.text) {
        logger.info(`Forwarding text message for chat=${chatId}`);
        return ctx.bot.api.sendMessage({
            ...commonMessage,
            text: message.text,
        });
    }

    if (message.photo) {
        logger.info(`Forwarding photo for chat=${chatId}`);
        const photo = message.photo[message.photo.length - 1];

        return ctx.bot.api.sendPhoto({
            ...commonMessage,
            caption: message.caption,
            photo: photo.file_id,
        });
    }

    if (message.document) {
        logger.info(`Forwarding document for chat=${chatId}`);

        return ctx.bot.api.sendDocument({
            ...commonMessage,
            caption: message.caption,
            document: message.document.file_id,
        });
    }

    if (message.voice) {
        logger.info(`Forwarding voice note for chat=${chatId}`);

        return ctx.bot.api.sendVoice({
            ...commonMessage,
            caption: message.caption,
            voice: message.voice.file_id,
        });
    }

    if (message.video) {
        logger.info(`Forwarding video for chat=${chatId}`);

        return ctx.bot.api.sendVideo({
            ...commonMessage,
            caption: message.caption,
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
export const onAdminReply = async (ctx: ForwardContext) => {
    logger.info(`onAdminReply`);

    try {
        const sentMessage = await forwardMessageToUser(ctx);

        if (!sentMessage) {
            logger.warn(ctx.message, 'Unsupported message type');
            await replyWithError(ctx, 'Unsupported message type. Please send text, photo, voice, video, or document.');
            return;
        }

        logger.info(`Saving message ${sentMessage.message_id} to database`);

        await ctx.db.saveMessage(
            mapTelegramMessageToSavedMessage(
                {
                    ...ctx.message,
                    message_id: sentMessage.message_id,
                    reply_to_message: sentMessage.reply_to_message,
                } as TelegramMessage,
                'admin',
            ),
        );

        await updateThreadByMessage(ctx, ctx.thread!, sentMessage);

        logger.info(`Sending success to user`);
        await replyWithSuccess(ctx, `Reply sent to user`);
    } catch (err: any) {
        logger.error(err, 'Error forward message to user.');
        await replyWithError(ctx, `Could not forward message to user, please try again.`);
    }
};

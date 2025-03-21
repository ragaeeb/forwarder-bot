import type { SavedMessage } from '@/types.js';
import type { TelegramMessage } from 'gramio';

/**
 * Determines the media type contained in a message.
 * Checks for photo, document, video, voice, audio, or sticker content.
 *
 * @param {TelegramMessage} message - The Telegram message to analyze
 * @returns {string|undefined} The type of media found, or undefined if none
 */
const getMediaType = (message: TelegramMessage) => {
    return (['photo', 'document', 'video', 'voice', 'audio', 'sticker'] as const).find((key) => message[key]);
};

/**
 * Extracts the media file ID from a message.
 * For photos, returns the largest (highest quality) photo file ID.
 * For other media types, returns the file ID if present.
 *
 * @param {TelegramMessage} message - The Telegram message to extract from
 * @returns {string|undefined} The media file ID, or undefined if no media
 */
const getMediaId = (message: TelegramMessage) => {
    if (message.photo && message.photo.length > 0) {
        return message.photo[message.photo.length - 1].file_id;
    }

    return [
        message.document?.file_id,
        message.video?.file_id,
        message.voice?.file_id,
        message.audio?.file_id,
        message.sticker?.file_id,
    ].find(Boolean);
};

/**
 * Maps a Telegram message to a standardized SavedMessage format.
 * Extracts relevant data and media information for storage.
 *
 * @param {TelegramMessage} message - The Telegram message to convert
 * @param {'admin'|'user'} type - Whether the message is from an admin or user
 * @returns {SavedMessage} Standardized message object for storage
 */
export const mapTelegramMessageToSavedMessage = (message: TelegramMessage, type: 'admin' | 'user'): SavedMessage => {
    const mediaType = getMediaType(message);
    const mediaId = getMediaId(message);

    return {
        chatId: message.chat.id.toString(),
        from: {
            ...(message.from?.first_name && { firstName: message.from?.first_name }),
            ...(message.from?.last_name && { lastName: message.from?.last_name }),
            ...(message.from?.username && { username: message.from?.username }),
            userId: message.from?.id.toString() as string,
        },
        id: message.message_id.toString(),
        text: message.text || '',
        timestamp: new Date(message.date * 1000).toISOString(), // Convert Unix timestamp (seconds) to ISO string
        type,
        ...(message.caption && { caption: message.caption }),
        ...(message.forward_origin && { forwardOrigin: message.forward_origin }),
        ...(mediaType && { mediaType }),
        ...(mediaId && { mediaId }),
        ...(message.quote?.text && { quote: message.quote.text }),
        ...(message.reply_to_message?.message_id && {
            replyToMessageId: message.reply_to_message.message_id.toString(),
        }),
    };
};

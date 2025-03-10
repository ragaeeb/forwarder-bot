import type { SavedMessage } from '@/types.js';
import type { TelegramMessage } from 'gramio';

const getMediaType = (message: TelegramMessage) => {
    return (['photo', 'document', 'video', 'voice', 'audio', 'sticker'] as const).find((key) => message[key]);
};

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

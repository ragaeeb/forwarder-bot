import { SavedMessage } from '@/types.js';
import { TelegramMessage } from 'gramio';

const getMediaType = (message: TelegramMessage) => {
    return (['photo', 'document', 'video', 'voice', 'audio', 'sticker'] as const).find((key) => message[key]);
};

const getMediaId = (message: TelegramMessage) => {
    if (message.photo && message.photo?.length > 0) {
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
    return {
        caption: message.caption,
        chatId: message.chat.id.toString(),
        forwardOrigin: message.forward_origin,
        from: {
            firstName: message.from?.first_name,
            lastName: message.from?.last_name,
            userId: message.from?.id.toString() as string,
            username: message.from?.username,
        },
        id: message.message_id.toString(),
        mediaId: getMediaId(message),
        mediaType: getMediaType(message),
        quote: message.quote?.text,
        replyToMessageId: message.reply_to_message?.message_id.toString(),
        text: message.text || '',
        timestamp: new Date(message.date * 1000).toISOString(),
        type,
    };
};

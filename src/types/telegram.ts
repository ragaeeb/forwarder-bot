/**
 * Basic Telegram types used in the application
 * Only subset of actual Telegram types that are needed for this project
 */

/**
 * Represents an audio message
 */
interface TelegramAudio {
    duration: number;
    file_id: string;
    file_name?: string;
    file_size?: number;
    file_unique_id: string;
    mime_type?: string;
    performer?: string;
    title?: string;
}

/**
 * Represents a Telegram chat
 */
interface TelegramChat {
    first_name?: string;
    id: number;
    last_name?: string;
    title?: string;
    type: 'channel' | 'group' | 'private' | 'supergroup';
    username?: string;
}

/**
 * Represents a Telegram chat member
 */
interface TelegramChatMember {
    status: TelegramChatMemberStatus;
    user: TelegramUser;
}

/**
 * Chat member statuses
 */
type TelegramChatMemberStatus = 'administrator' | 'creator' | 'kicked' | 'left' | 'member' | 'restricted';

/**
 * Represents a document
 */
interface TelegramDocument {
    file_id: string;
    file_name?: string;
    file_size?: number;
    file_unique_id: string;
    mime_type?: string;
}

/**
 * Represents a forum topic in a supergroup
 */
interface TelegramForumTopic {
    message_thread_id: number;
    name: string;
}

/**
 * Represents a Telegram message
 */
interface TelegramMessage {
    audio?: TelegramAudio;
    caption?: string;
    chat: TelegramChat;
    date: number;
    document?: TelegramDocument;
    forward_origin?: TelegramMessageOrigin;
    from?: TelegramUser;
    message_id: number;
    message_thread_id?: number;
    photo?: TelegramPhotoSize[];
    quote?: TelegramQuote;
    reply_to_message?: TelegramMessage;
    sender_chat?: TelegramChat;
    sticker?: TelegramSticker;
    text?: string;
    video?: TelegramVideo;
    voice?: TelegramVoice;
}

/**
 * Represents a message origin
 */
interface TelegramMessageOrigin {
    chat?: TelegramChat;
    date: number;
    sender_chat?: TelegramChat;
    sender_user?: TelegramUser;
    type: string;
}

/**
 * Represents a photo size
 */
interface TelegramPhotoSize {
    file_id: string;
    file_size?: number;
    file_unique_id: string;
    height: number;
    width: number;
}

/**
 * Represents a message quote
 */
interface TelegramQuote {
    entities: any[];
    position: number;
    text: string;
}

/**
 * Represents a sticker
 */
interface TelegramSticker {
    emoji?: string;
    file_id: string;
    file_unique_id: string;
    height: number;
    is_animated: boolean;
    is_video: boolean;
    set_name?: string;
    type: string;
    width: number;
}

/**
 * Represents a Telegram update
 */
interface TelegramUpdate {
    edited_message?: TelegramMessage;
    message?: TelegramMessage;
    update_id: number;
}

/**
 * Represents a Telegram user
 */
interface TelegramUser {
    first_name: string;
    id: number;
    is_bot?: boolean;
    last_name?: string;
    username?: string;
}

/**
 * Represents a video
 */
interface TelegramVideo {
    duration: number;
    file_id: string;
    file_name?: string;
    file_size?: number;
    file_unique_id: string;
    height: number;
    mime_type?: string;
    width: number;
}

/**
 * Represents a voice message
 */
interface TelegramVoice {
    duration: number;
    file_id: string;
    file_size?: number;
    file_unique_id: string;
    mime_type?: string;
}

export type {
    TelegramAudio,
    TelegramChat,
    TelegramChatMember,
    TelegramChatMemberStatus,
    TelegramDocument,
    TelegramForumTopic,
    TelegramMessage,
    TelegramMessageOrigin,
    TelegramPhotoSize,
    TelegramQuote,
    TelegramSticker,
    TelegramUpdate,
    TelegramUser,
    TelegramVideo,
    TelegramVoice,
};

import type { Context } from './bot.js';
import type { DataService } from './services/types.js';
import type { TelegramMessageOrigin, TelegramUser } from './types/telegram.js';

/**
 * Settings for the bot
 */
export interface BotSettings {
    ack?: string;
    adminGroupId: string;
    configId: string;
    failure?: string;
    greeting?: string;
    setupAt: string;
    setupBy: TelegramUser;
}

/**
 * Context for forwarding messages
 */
export type ForwardContext = Context & {
    db: DataService;
    settings: BotSettings;
    thread?: ThreadData;
};

/**
 * Information about a saved message
 */
export interface SavedMessage {
    caption?: string;
    chatId: string;
    forwardOrigin?: TelegramMessageOrigin;
    from: {
        firstName?: string;
        lastName?: string;
        userId: string;
        username?: string;
    };
    id: string;
    mediaId?: string;
    mediaType?: string;
    originalMessageId?: string; // for edited messages
    quote?: string;
    replyToMessageId?: string;
    text: string;
    timestamp: string;
    type: 'admin' | 'user';
}

/**
 * Information about a thread
 */
export interface ThreadData {
    chatId: string;
    createdAt: string;
    lastMessageId: string;
    name: string;
    threadId: string;
    updatedAt: string;
    userId: string;
}

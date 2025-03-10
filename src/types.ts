import type { Bot, DeriveDefinitions, MessageContext, TelegramMessageOrigin, TelegramUser } from 'gramio';

import type { DynamoDBService } from './services/dynamodb.js';

export interface BotConfig {
    adminGroupId: string;
    configId: string;
    setupAt: string;
    setupBy: TelegramUser;
}

export type ForwardContext = MessageContext<Bot<Record<string, never>, DeriveDefinitions>> & {
    api: Bot<Record<string, never>, DeriveDefinitions>['api'];
    args: null | string;
    db: DynamoDBService;
    me: TelegramUser;
    bot: Bot;
};

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

export interface ThreadData {
    chatId: string;
    createdAt: string;
    lastMessageId: string;
    name: string;
    threadId: string;
    updatedAt: string;
    userId: string;
}

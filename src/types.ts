/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { Bot, DeriveDefinitions, MessageContext, TelegramUser } from 'gramio';

import type { DynamoDBService } from './services/dynamodb.js';

export interface BotConfig {
    configId: string;
    contactGroupId: string;
    setupAt: string;
}

export type ForwardContext = MessageContext<Bot<{}, DeriveDefinitions>> & {
    api?: BotAPI;
    args: null | string;
    db?: DynamoDBService;
    me?: TelegramUser;
};

export interface Message {
    adminId?: string;
    adminName?: string;
    caption?: string;
    chatId: string;
    mediaId?: string;
    mediaType?: string;
    messageId: string;
    text: string;
    timestamp: string;
    type: 'admin' | 'user';
    userId: string;
}

export interface ThreadData {
    chatId: string;
    createdAt: string;
    firstName?: string;
    lastMessageId: number;
    threadId: string;
    updatedAt: string;
    userId: string;
    username?: string;
}

export interface UserState {
    [key: string]: boolean | number | object | string | undefined;
    state: string;
}

type BotAPI = Bot<{}, DeriveDefinitions>['api'];

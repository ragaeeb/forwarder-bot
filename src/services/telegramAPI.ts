import type {
    TelegramChatMember,
    TelegramForumTopic,
    TelegramMessage,
    TelegramUpdate,
    TelegramUser,
} from '@/types/telegram.js';

import logger from '@/utils/logger.js';

import { config } from '../config.js';

// Define base types for Telegram API responses
export interface TelegramResponse<T> {
    description?: string;
    error_code?: number;
    ok: boolean;
    result?: T;
}

// Base URL for Telegram API
const BASE_URL = 'https://api.telegram.org/bot';

/**
 * Makes a request to the Telegram Bot API
 *
 * @template T - Response type
 * @param {string} method - Telegram API method name
 * @param {Record<string, any>} [params] - Parameters for the method
 * @returns {Promise<T>} - Response from Telegram API
 */
export const callTelegramAPI = async <T = any>(method: string, params?: Record<string, any>): Promise<T> => {
    try {
        const url = `${BASE_URL}${config.BOT_TOKEN}/${method}`;
        const headers = {
            'Content-Type': 'application/json',
        };

        const options: RequestInit = {
            body: params ? JSON.stringify(params) : undefined,
            headers,
            method: 'POST',
        };

        logger.debug(`Calling Telegram API: ${method}`);

        const response = await fetch(url, options);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Telegram API error (${response.status}): ${errorText}`);
        }

        const data = (await response.json()) as TelegramResponse<T>;

        if (!data.ok) {
            throw new Error(
                `Telegram API error: ${data.description || 'Unknown error'} (${data.error_code || 'No code'})`,
            );
        }

        return data.result as T;
    } catch (error) {
        logger.error(error, `Error calling Telegram API: ${method}`);
        throw error;
    }
};

/**
 * Class to interact with the Telegram Bot API
 */
export class TelegramAPI {
    private me: TelegramUser | undefined;

    /**
     * Creates a topic in a forum (supergroup)
     *
     * @param {Object} params - Parameters for creating a forum topic
     * @returns {Promise<TelegramForumTopic>} - Created forum topic
     */
    async createForumTopic(params: {
        chat_id: number | string;
        icon_color?: number;
        icon_custom_emoji_id?: string;
        name: string;
    }): Promise<TelegramForumTopic> {
        return callTelegramAPI<TelegramForumTopic>('createForumTopic', params);
    }

    /**
     * Deletes a topic in a forum (supergroup)
     *
     * @param {Object} params - Parameters for deleting a forum topic
     * @returns {Promise<boolean>} - True if successful
     */
    async deleteForumTopic(params: { chat_id: number | string; message_thread_id: number }): Promise<boolean> {
        return callTelegramAPI<boolean>('deleteForumTopic', params);
    }

    /**
     * Deletes the bot's webhook
     *
     * @param {Object} params - Parameters for deleting the webhook
     * @returns {Promise<boolean>} - True if successful
     */
    async deleteWebhook(params?: { drop_pending_updates?: boolean }): Promise<boolean> {
        return callTelegramAPI<boolean>('deleteWebhook', params);
    }

    /**
     * Forwards a message
     *
     * @param {Object} params - Parameters for forwarding a message
     * @returns {Promise<TelegramMessage>} - Forwarded message
     */
    async forwardMessage(params: {
        chat_id: number | string;
        from_chat_id: number | string;
        message_id: number;
        message_thread_id?: number;
    }): Promise<TelegramMessage> {
        return callTelegramAPI<TelegramMessage>('forwardMessage', params);
    }

    /**
     * Gets information about a chat member
     *
     * @param {Object} params - Parameters for getting chat member
     * @returns {Promise<TelegramChatMember>} - Chat member information
     */
    async getChatMember(params: { chat_id: number | string; user_id: number }): Promise<TelegramChatMember> {
        return callTelegramAPI<TelegramChatMember>('getChatMember', params);
    }

    /**
     * Gets information about the bot
     *
     * @returns {Promise<TelegramUser>} - Bot information
     */
    async getMe(): Promise<TelegramUser> {
        if (!this.me) {
            this.me = await callTelegramAPI<TelegramUser>('getMe');
        }

        return this.me;
    }

    /**
     * Gets updates from Telegram using long polling
     *
     * @param {Object} params - Parameters for getting updates
     * @returns {Promise<TelegramUpdate[]>} - Array of updates
     */
    async getUpdates(params?: {
        allowed_updates?: string[];
        limit?: number;
        offset?: number;
        timeout?: number;
    }): Promise<TelegramUpdate[]> {
        return callTelegramAPI<TelegramUpdate[]>('getUpdates', params || {});
    }

    /**
     * Leaves a chat
     *
     * @param {Object} params - Parameters for leaving a chat
     * @returns {Promise<boolean>} - True if successful
     */
    async leaveChat(params: { chat_id: number | string }): Promise<boolean> {
        return callTelegramAPI<boolean>('leaveChat', params);
    }

    /**
     * Sends a document
     *
     * @param {Object} params - Parameters for sending a document
     * @returns {Promise<TelegramMessage>} - Sent message
     */
    async sendDocument(params: {
        caption?: string;
        chat_id: number | string;
        document: string;
        protect_content?: boolean;
    }): Promise<TelegramMessage> {
        return callTelegramAPI<TelegramMessage>('sendDocument', params);
    }

    /**
     * Sends a message
     *
     * @param {Object} params - Parameters for sending a message
     * @returns {Promise<TelegramMessage>} - Sent message
     */
    async sendMessage(params: {
        chat_id: number | string;
        message_thread_id?: number;
        parse_mode?: 'HTML' | 'Markdown';
        protect_content?: boolean;
        text: string;
    }): Promise<TelegramMessage> {
        return callTelegramAPI<TelegramMessage>('sendMessage', params);
    }

    /**
     * Sends a photo
     *
     * @param {Object} params - Parameters for sending a photo
     * @returns {Promise<TelegramMessage>} - Sent message
     */
    async sendPhoto(params: {
        caption?: string;
        chat_id: number | string;
        photo: string;
        protect_content?: boolean;
    }): Promise<TelegramMessage> {
        return callTelegramAPI<TelegramMessage>('sendPhoto', params);
    }

    /**
     * Sends a video
     *
     * @param {Object} params - Parameters for sending a video
     * @returns {Promise<TelegramMessage>} - Sent message
     */
    async sendVideo(params: {
        caption?: string;
        chat_id: number | string;
        protect_content?: boolean;
        video: string;
    }): Promise<TelegramMessage> {
        return callTelegramAPI<TelegramMessage>('sendVideo', params);
    }

    /**
     * Sends a voice message
     *
     * @param {Object} params - Parameters for sending a voice message
     * @returns {Promise<TelegramMessage>} - Sent message
     */
    async sendVoice(params: {
        caption?: string;
        chat_id: number | string;
        protect_content?: boolean;
        voice: string;
    }): Promise<TelegramMessage> {
        return callTelegramAPI<TelegramMessage>('sendVoice', params);
    }

    /**
     * Sets a webhook for the bot
     *
     * @param {Object} params - Parameters for setting the webhook
     * @returns {Promise<boolean>} - True if successful
     */
    async setWebhook(params: { drop_pending_updates?: boolean; secret_token?: string; url: string }): Promise<boolean> {
        return callTelegramAPI<boolean>('setWebhook', params);
    }
}

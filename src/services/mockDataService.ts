import logger from '@/utils/logger.js';

import type { BotSettings, SavedMessage, ThreadData } from '../types.js';

import { DataService } from './types.js';

export class MockDataService implements DataService {
    private botConfig?: BotSettings;
    private messages: SavedMessage[];
    private threads: ThreadData[];

    constructor() {
        logger.info(`Using Mock table`);

        this.messages = [];
        this.threads = [];
    }

    /**
     * Retrieves the bot configuration from the database
     * @returns {Promise<BotSettings | null>} The bot configuration or null if not found or on error
     */
    async getSettings(): Promise<BotSettings | undefined> {
        return this.botConfig;
    }

    /**
     * Retrieves messages for a specific user
     * @param {string} userId - The user ID to fetch messages for
     * @returns {Promise<SavedMessage[]>} Array of messages or empty array if none found or on error
     */
    async getMessagesByUserId(userId: string): Promise<SavedMessage[]> {
        return this.messages.filter((m) => m.from.userId === userId);
    }

    /**
     * Retrieves a thread by its ID
     * @param {string} threadId - The thread ID to look up
     * @returns {Promise<ThreadData | undefined>} The thread data or undefined if not found or on error
     */
    async getThreadById(threadId: string): Promise<ThreadData | undefined> {
        return this.threads.find((t) => t.threadId === threadId);
    }

    /**
     * Retrieves a thread by the user ID it's associated with
     * @param {string} userId - The user ID to look up the thread for
     * @returns {Promise<ThreadData | undefined>} The thread data or undefined if not found or on error
     */
    async getThreadByUserId(userId: string): Promise<ThreadData | undefined> {
        return this.threads.find((t) => t.userId === userId);
    }

    /**
     * Saves the bot configuration to the database
     * @param {BotSettings} config - The configuration to save
     * @returns {Promise<BotSettings>} The saved configuration
     * @throws Will throw an error if the save operation fails
     */
    async saveSettings(botConfig: BotSettings): Promise<BotSettings> {
        this.botConfig = botConfig;
        return botConfig;
    }

    /**
     * Saves a message to the database
     * Messages are stored with a composite key of userId#messages to group them by user
     * @param {SavedMessage} message - The message to save
     * @returns {Promise<SavedMessage>} The saved message
     * @throws Will throw an error if the save operation fails
     */
    async saveMessage(message: SavedMessage): Promise<SavedMessage> {
        this.messages.push(message);
        return message;
    }

    /**
     * Saves a thread to the database
     * @param {ThreadData} thread - The thread data to save
     * @returns {Promise<ThreadData>} The saved thread data
     * @throws Will throw an error if the save operation fails
     */
    async saveThread(thread: ThreadData): Promise<ThreadData> {
        this.threads.push(thread);
        return thread;
    }
}

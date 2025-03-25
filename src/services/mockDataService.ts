import logger from '@/utils/logger.js';

import type { BotSettings, SavedMessage, ThreadData } from '../types/app.js';

import { DataService } from './types.js';

/**
 * Mock implementation of the DataService interface for local development and testing.
 * Stores all data in memory rather than in a database.
 */
export class MockDataService implements DataService {
    private botConfig?: BotSettings;
    private messages: SavedMessage[];
    private threads: ThreadData[];

    /**
     * Creates a new MockDataService instance.
     * Initializes empty arrays for messages and threads.
     */
    constructor() {
        logger.info(`Using Mock table`);

        this.messages = [];
        this.threads = [];
    }

    /**
     * Retrieves messages for a specific user.
     *
     * @param {string} userId - The user ID to fetch messages for
     * @returns {Promise<SavedMessage[]>} Array of messages for the user
     */
    async getMessagesByUserId(userId: string): Promise<SavedMessage[]> {
        return this.messages.filter((m) => m.from.userId === userId);
    }

    /**
     * Retrieves the bot configuration from memory.
     *
     * @returns {Promise<BotSettings | undefined>} The bot settings or undefined if not set
     */
    async getSettings(): Promise<BotSettings | undefined> {
        return this.botConfig;
    }

    /**
     * Retrieves a thread by its ID.
     *
     * @param {string} threadId - The thread ID to look up
     * @returns {Promise<ThreadData | undefined>} The thread data or undefined if not found
     */
    async getThreadById(threadId: string): Promise<ThreadData | undefined> {
        return this.threads.find((t) => t.threadId === threadId);
    }

    /**
     * Retrieves a thread by the user ID it's associated with.
     *
     * @param {string} userId - The user ID to look up the thread for
     * @returns {Promise<ThreadData | undefined>} The thread data or undefined if not found
     */
    async getThreadByUserId(userId: string): Promise<ThreadData | undefined> {
        return this.threads.find((t) => t.userId === userId);
    }

    /**
     * Saves a message to memory.
     *
     * @param {SavedMessage} message - The message to save
     * @returns {Promise<SavedMessage>} The saved message
     */
    async saveMessage(message: SavedMessage): Promise<SavedMessage> {
        this.messages.push(message);
        return message;
    }

    /**
     * Saves the bot configuration to memory.
     *
     * @param {BotSettings} botConfig - The configuration to save
     * @returns {Promise<BotSettings>} The saved configuration
     */
    async saveSettings(botConfig: BotSettings): Promise<BotSettings> {
        this.botConfig = botConfig;
        return botConfig;
    }

    /**
     * Saves a thread to memory.
     *
     * @param {ThreadData} thread - The thread data to save
     * @returns {Promise<ThreadData>} The saved thread data
     */
    async saveThread(thread: ThreadData): Promise<ThreadData> {
        this.threads.push(thread);
        return thread;
    }
}

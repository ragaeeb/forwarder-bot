import type { BotSettings, SavedMessage, ThreadData } from '@/types/app.js';

/**
 * Interface defining data storage operations for the bot.
 * Provides methods for storing and retrieving messages, threads, and settings.
 * Implementations can use different storage backends (e.g., DynamoDB, in-memory).
 */
export interface DataService {
    /**
     * Retrieves messages for a specific user
     *
     * @param {string} userId - The user ID to fetch messages for
     * @returns {Promise<SavedMessage[]>} Array of messages for the user
     */
    getMessagesByUserId(userId: string): Promise<SavedMessage[]>;

    /**
     * Retrieves the bot configuration from storage
     *
     * @returns {Promise<BotSettings | undefined>} The bot settings or undefined if not set
     */
    getSettings(): Promise<BotSettings | undefined>;

    /**
     * Retrieves a thread by its ID
     *
     * @param {string} threadId - The thread ID to look up
     * @returns {Promise<ThreadData | undefined>} The thread data or undefined if not found
     */
    getThreadById(threadId: string): Promise<ThreadData | undefined>;

    /**
     * Retrieves a thread by the user ID it's associated with
     *
     * @param {string} userId - The user ID to look up the thread for
     * @returns {Promise<ThreadData | undefined>} The thread data or undefined if not found
     */
    getThreadByUserId(userId: string): Promise<ThreadData | undefined>;

    /**
     * Saves a message to storage
     *
     * @param {SavedMessage} message - The message to save
     * @returns {Promise<SavedMessage>} The saved message
     */
    saveMessage(message: SavedMessage): Promise<SavedMessage>;

    /**
     * Saves the bot configuration to storage
     *
     * @param {BotSettings} config - The configuration to save
     * @returns {Promise<BotSettings>} The saved configuration
     */
    saveSettings(config: BotSettings): Promise<BotSettings>;

    /**
     * Saves a thread to storage
     *
     * @param {ThreadData} thread - The thread data to save
     * @returns {Promise<ThreadData>} The saved thread data
     */
    saveThread(thread: ThreadData): Promise<ThreadData>;
}

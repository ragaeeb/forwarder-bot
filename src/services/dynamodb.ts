import logger from '@/utils/logger.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

import type { BotSettings, SavedMessage, ThreadData } from '../types.js';
import type { DataService } from './types.js';

import { config } from '../config.js';

/**
 * Service class for interacting with DynamoDB.
 * Implements the DataService interface for database operations.
 * Handles all database operations for the bot including storing and retrieving
 * messages, threads, and bot settings.
 */
export class DynamoDBService implements DataService {
    private client: DynamoDBDocumentClient;
    private tableName: string;

    /**
     * Creates a new DynamoDBService instance.
     * Initializes the DynamoDB client and sets the table name from config.
     */
    constructor() {
        const dbClient = new DynamoDBClient({});
        this.client = DynamoDBDocumentClient.from(dbClient);
        this.tableName = config.TABLE_NAME;
        logger.info(`Using DynamoDB table: ${this.tableName}`);
    }

    /**
     * Retrieves messages for a specific user.
     *
     * @param {string} userId - The user ID to fetch messages for
     * @returns {Promise<SavedMessage[]>} Array of messages or empty array if none found
     * @throws Will throw an error if the database operation fails
     */
    async getMessagesByUserId(userId: string): Promise<SavedMessage[]> {
        try {
            logger.info(`getMessagesByUserId=${userId}`);

            const response = await this.client.send(
                new QueryCommand({
                    ExpressionAttributeValues: {
                        ':userId': `${userId}#messages`,
                    },
                    KeyConditionExpression: 'userId = :userId',
                    ScanIndexForward: false, // Sort by most recent first
                    TableName: this.tableName,
                }),
            );

            logger.info(`getMessagesByUserId items.length=${response.Items?.length}`);

            return (response.Items || []) as SavedMessage[];
        } catch (error) {
            logger.error({ error, userId }, 'Error getting messages by user ID');
            throw error;
        }
    }

    /**
     * Retrieves the bot configuration from the database.
     *
     * @returns {Promise<BotSettings | undefined>} The bot settings or undefined if not found
     * @throws Will throw an error if the database operation fails
     */
    async getSettings(): Promise<BotSettings | undefined> {
        try {
            logger.info(`getSettings()`);

            const response = await this.client.send(
                new GetCommand({
                    Key: { userId: 'config' },
                    TableName: this.tableName,
                }),
            );

            logger.info(`getSettings() result: ${Boolean(response.Item)}`);

            return response.Item as BotSettings;
        } catch (error) {
            logger.error(error, 'Error getting bot config');
            throw error;
        }
    }

    /**
     * Retrieves a thread by its ID.
     * Uses a global secondary index to look up threads by thread ID.
     *
     * @param {string} threadId - The thread ID to look up
     * @returns {Promise<ThreadData | undefined>} The thread data or undefined if not found
     * @throws Will throw an error if the database operation fails
     */
    async getThreadById(threadId: string): Promise<ThreadData | undefined> {
        try {
            logger.info(`getThreadById ${threadId}`);

            const response = await this.client.send(
                new QueryCommand({
                    ExpressionAttributeValues: {
                        ':threadId': threadId,
                    },
                    IndexName: 'ThreadIdIndex',
                    KeyConditionExpression: 'threadId = :threadId',
                    TableName: this.tableName,
                }),
            );

            logger.info(`getThreadById items.length=${response.Items?.length}`);

            if (response.Items && response.Items.length > 0) {
                return response.Items[0] as ThreadData;
            }
        } catch (error) {
            logger.error({ error, threadId }, `Error getting thread by thread ID`);
            throw error;
        }
    }

    /**
     * Retrieves a thread by the user ID it's associated with.
     *
     * @param {string} userId - The user ID to look up the thread for
     * @returns {Promise<ThreadData | undefined>} The thread data or undefined if not found
     * @throws Will throw an error if the database operation fails
     */
    async getThreadByUserId(userId: string): Promise<ThreadData | undefined> {
        try {
            logger.info(`getThreadByUserId: ${userId}`);
            const response = await this.client.send(
                new GetCommand({
                    Key: { userId },
                    TableName: this.tableName,
                }),
            );

            logger.info(`getThreadByUserId: ${Boolean(response.Item)}`);
            return response.Item as ThreadData;
        } catch (error) {
            logger.error({ error, userId }, 'Error getting thread by user ID');
            throw error;
        }
    }

    /**
     * Saves a message to the database.
     * Messages are stored with a composite key of userId#messages to group them by user.
     *
     * @param {SavedMessage} message - The message to save
     * @returns {Promise<SavedMessage>} The saved message
     * @throws Will throw an error if the database operation fails
     */
    async saveMessage(message: SavedMessage): Promise<SavedMessage> {
        try {
            const messageData = {
                ...message,
                userId: `${message.from.userId}#messages`,
            };

            logger.info(`saveMessage ${message.id}`);

            await this.client.send(
                new PutCommand({
                    Item: messageData,
                    TableName: this.tableName,
                }),
            );

            return message;
        } catch (error) {
            logger.error({ error, message }, 'Error saving message');
            throw error;
        }
    }

    /**
     * Saves the bot configuration to the database.
     *
     * @param {BotSettings} config - The configuration to save
     * @returns {Promise<BotSettings>} The saved configuration
     * @throws Will throw an error if the database operation fails
     */
    async saveSettings(config: BotSettings): Promise<BotSettings> {
        try {
            logger.info(config, `saveSettings`);

            await this.client.send(
                new PutCommand({
                    Item: {
                        userId: 'config',
                        ...config,
                    },
                    TableName: this.tableName,
                }),
            );

            return config;
        } catch (error) {
            logger.error({ config, error }, 'Error saving bot config');
            throw error;
        }
    }

    /**
     * Saves a thread to the database.
     *
     * @param {ThreadData} thread - The thread data to save
     * @returns {Promise<ThreadData>} The saved thread data
     * @throws Will throw an error if the database operation fails
     */
    async saveThread(thread: ThreadData): Promise<ThreadData> {
        try {
            logger.info(`saveThread ${thread.threadId}`);
            await this.client.send(
                new PutCommand({
                    Item: thread,
                    TableName: this.tableName,
                }),
            );

            return thread;
        } catch (error) {
            logger.error({ error, thread }, 'Error saving thread');
            throw error;
        }
    }
}

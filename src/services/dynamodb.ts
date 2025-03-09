import logger from '@/utils/logger.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

import { config } from '../config.js';
import { BotConfig, SavedMessage as SavedMessage, ThreadData } from '../types.js';

export class DynamoDBService {
    private client: DynamoDBDocumentClient;
    private tableName: string;

    constructor() {
        const dbClient = new DynamoDBClient({});
        this.client = DynamoDBDocumentClient.from(dbClient);
        this.tableName = config.TABLE_NAME;
    }

    async getConfig(): Promise<BotConfig | null> {
        try {
            const response = await this.client.send(
                new GetCommand({
                    Key: { userId: 'config' },
                    TableName: this.tableName,
                }),
            );

            return (response.Item as BotConfig) || null;
        } catch (error) {
            logger.error('Error getting bot config', error);
            return null;
        }
    }

    async getMessagesByUserId(userId: string): Promise<SavedMessage[]> {
        try {
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

            return (response.Items || []) as SavedMessage[];
        } catch (error) {
            logger.error('Error getting messages by user ID', { error, userId });
            return [];
        }
    }

    async getThreadById(threadId: string): Promise<ThreadData | undefined> {
        try {
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

            if (response.Items && response.Items.length > 0) {
                return response.Items[0] as ThreadData;
            }
        } catch (error) {
            logger.error('Error getting thread by thread ID', { error, threadId });
        }
    }

    async getThreadByUserId(userId: string): Promise<ThreadData | undefined> {
        try {
            const response = await this.client.send(
                new GetCommand({
                    Key: { userId },
                    TableName: this.tableName,
                }),
            );

            return response.Item as ThreadData;
        } catch (error) {
            logger.error('Error getting thread by user ID', { error, userId });
        }
    }

    async saveConfig(config: BotConfig): Promise<BotConfig> {
        try {
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
            logger.error('Error saving bot config', { config, error });
            throw error;
        }
    }

    async saveMessage(message: SavedMessage): Promise<SavedMessage> {
        try {
            const messageData = {
                ...message,
                userId: `${message.from.userId}#messages`,
            };

            await this.client.send(
                new PutCommand({
                    Item: messageData,
                    TableName: this.tableName,
                }),
            );

            return message;
        } catch (error) {
            logger.error('Error saving message', { error, message });
            throw error;
        }
    }

    async saveThread(thread: ThreadData): Promise<ThreadData> {
        try {
            await this.client.send(
                new PutCommand({
                    Item: thread,
                    TableName: this.tableName,
                }),
            );

            return thread;
        } catch (error) {
            logger.error('Error saving thread', { error, thread });
            throw error;
        }
    }
}

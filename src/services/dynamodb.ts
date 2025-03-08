import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

import { config } from '../config.js';
import { BotConfig, Message, ThreadData, UserState } from '../types.js';

export class DynamoDBService {
    private client: DynamoDBDocumentClient;
    private tableName: string;

    constructor() {
        const dbClient = new DynamoDBClient({});
        this.client = DynamoDBDocumentClient.from(dbClient);
        this.tableName = config.TABLE_NAME;
    }

    // Bot configuration methods
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
            console.error('Error getting bot config', error);
            return null;
        }
    }

    async getMessagesByUserId(userId: string): Promise<Message[]> {
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

            return (response.Items || []) as Message[];
        } catch (error) {
            console.error('Error getting messages by user ID', { error, userId });
            return [];
        }
    }

    async getThreadByThreadId(threadId: string): Promise<null | ThreadData> {
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

            return response.Items && response.Items.length > 0 ? (response.Items[0] as ThreadData) : null;
        } catch (error) {
            console.error('Error getting thread by thread ID', { error, threadId });
            return null;
        }
    }

    async getThreadByUserId(userId: string): Promise<null | ThreadData> {
        try {
            const response = await this.client.send(
                new GetCommand({
                    Key: { userId },
                    TableName: this.tableName,
                }),
            );

            return (response.Item as ThreadData) || null;
        } catch (error) {
            console.error('Error getting thread by user ID', { error, userId });
            return null;
        }
    }

    // User state methods for setup flows
    async getUserState(userId: string): Promise<null | UserState> {
        try {
            const response = await this.client.send(
                new GetCommand({
                    Key: { userId: `${userId}#state` },
                    TableName: this.tableName,
                }),
            );

            return (response.Item as UserState) || null;
        } catch (error) {
            console.error('Error getting user state', { error, userId });
            return null;
        }
    }

    async saveConfig(config: BotConfig): Promise<void> {
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
        } catch (error) {
            console.error('Error saving bot config', { config, error });
            throw error;
        }
    }

    async saveMessage(message: Message): Promise<void> {
        try {
            const messageData = {
                ...message,
                userId: `${message.userId}#messages`,
            };

            await this.client.send(
                new PutCommand({
                    Item: messageData,
                    TableName: this.tableName,
                }),
            );
        } catch (error) {
            console.error('Error saving message', { error, message });
            throw error;
        }
    }

    async saveThread(thread: ThreadData): Promise<void> {
        try {
            await this.client.send(
                new PutCommand({
                    Item: thread,
                    TableName: this.tableName,
                }),
            );
        } catch (error) {
            console.error('Error saving thread', { error, thread });
            throw error;
        }
    }
    async saveUserState(userId: string, state: UserState): Promise<void> {
        try {
            await this.client.send(
                new PutCommand({
                    Item: {
                        userId: `${userId}#state`,
                        ...state,
                    },
                    TableName: this.tableName,
                }),
            );
        } catch (error) {
            console.error('Error saving user state', { error, state, userId });
            throw error;
        }
    }
}

import logger from '@/utils/logger.js';

import { MongoClient, type Collection, type Db } from 'mongodb';

import type { BotSettings, SavedMessage, ThreadData } from '@/types/app.js';

import { config } from '@/config.js';

import type { DataService } from './types.js';

interface MessageDocument extends SavedMessage {
    actualUserId: string;
    messageId: string;
    userId: string;
}

interface ThreadDocument extends ThreadData {
    actualThreadId: string;
    actualUserId: string;
    threadId: string;
    userId: string;
}

interface SettingsDocument extends BotSettings {
    _id: string;
}

const COLLECTIONS = {
    messages: 'messages',
    settings: 'settings',
    threads: 'threads',
} as const;

const mongoClientSymbol = Symbol.for('forwarder-bot.mongoClient');

type GlobalWithMongo = typeof globalThis & {
    [mongoClientSymbol]?: Promise<MongoClient>;
};

const getGlobalMongoPromise = (): Promise<MongoClient> | undefined => {
    return (globalThis as GlobalWithMongo)[mongoClientSymbol];
};

const setGlobalMongoPromise = (promise: Promise<MongoClient>): void => {
    (globalThis as GlobalWithMongo)[mongoClientSymbol] = promise;
};

const getMongoClient = async (): Promise<MongoClient> => {
    let clientPromise = getGlobalMongoPromise();

    if (!clientPromise) {
        if (!config.mongo.uri) {
            throw new Error('MONGODB_URI must be configured to use the MongoDB data service');
        }

        clientPromise = MongoClient.connect(config.mongo.uri, {
            maxPoolSize: 10,
        });
        setGlobalMongoPromise(clientPromise);
    }

    return clientPromise;
};

export class MongoDataService implements DataService {
    public readonly botUsername: string;
    private dbPromise: Promise<Db>;

    constructor(botUsername: string) {
        this.botUsername = botUsername;
        this.dbPromise = (async () => {
            const client = await getMongoClient();
            return client.db(config.mongo.dbName);
        })();

        logger.info(`Using MongoDB database ${config.mongo.dbName} for @${botUsername}`);
    }

    private async collection<T>(name: (typeof COLLECTIONS)[keyof typeof COLLECTIONS]): Promise<Collection<T>> {
        const db = await this.dbPromise;
        return db.collection<T>(name);
    }

    private normalizeSavedMessage(document: MessageDocument): SavedMessage {
        const { actualUserId, userId: _userId, ...rest } = document;

        return {
            ...rest,
            botUsername: this.botUsername,
            from: {
                ...rest.from,
                userId: actualUserId,
            },
        };
    }

    private normalizeThread(document: ThreadDocument): ThreadData {
        const { actualThreadId, actualUserId, threadId: _threadId, userId: _userId, ...rest } = document;

        return {
            ...rest,
            botUsername: this.botUsername,
            threadId: actualThreadId,
            userId: actualUserId,
        };
    }

    async getMessagesByUserId(userId: string): Promise<SavedMessage[]> {
        try {
            const messages = await (await this.collection<MessageDocument>(COLLECTIONS.messages))
                .find({ botUsername: this.botUsername, userId: `${this.botUsername}#${userId}` })
                .sort({ timestamp: -1 })
                .toArray();

            return messages.map((document) => this.normalizeSavedMessage(document));
        } catch (error) {
            logger.error({ botUsername: this.botUsername, error, userId }, 'Error getting messages by user ID');
            throw error;
        }
    }

    async getSettings(): Promise<BotSettings | undefined> {
        try {
            const document = await (await this.collection<SettingsDocument>(COLLECTIONS.settings)).findOne({
                _id: this.botUsername,
            });

            if (!document) {
                return undefined;
            }

            const { _id, ...settings } = document;

            return { ...settings, botUsername: this.botUsername };
        } catch (error) {
            logger.error({ botUsername: this.botUsername, error }, 'Error getting bot config');
            throw error;
        }
    }

    async getThreadById(threadId: string): Promise<ThreadData | undefined> {
        try {
            const document = await (await this.collection<ThreadDocument>(COLLECTIONS.threads)).findOne({
                botUsername: this.botUsername,
                threadId: `${this.botUsername}#${threadId}`,
            });

            return document ? this.normalizeThread(document) : undefined;
        } catch (error) {
            logger.error({ botUsername: this.botUsername, error, threadId }, 'Error getting thread by thread ID');
            throw error;
        }
    }

    async getThreadByUserId(userId: string): Promise<ThreadData | undefined> {
        try {
            const document = await (await this.collection<ThreadDocument>(COLLECTIONS.threads))
                .find({ botUsername: this.botUsername, userId: `${this.botUsername}#${userId}` })
                .sort({ updatedAt: -1 })
                .limit(1)
                .next();

            return document ? this.normalizeThread(document) : undefined;
        } catch (error) {
            logger.error({ botUsername: this.botUsername, error, userId }, 'Error getting thread by user ID');
            throw error;
        }
    }

    async saveMessage(message: SavedMessage): Promise<SavedMessage> {
        try {
            const document: MessageDocument = {
                ...message,
                botUsername: this.botUsername,
                messageId: message.id,
                userId: `${this.botUsername}#${message.from.userId}`,
                actualUserId: message.from.userId,
            };

            await (await this.collection<MessageDocument>(COLLECTIONS.messages)).updateOne(
                { botUsername: this.botUsername, messageId: message.id },
                { $set: document },
                { upsert: true },
            );

            return { ...message, botUsername: this.botUsername };
        } catch (error) {
            logger.error({ botUsername: this.botUsername, error, message }, 'Error saving message');
            throw error;
        }
    }

    async saveSettings(config: BotSettings): Promise<BotSettings> {
        try {
            const document: SettingsDocument = {
                ...config,
                _id: this.botUsername,
                botUsername: this.botUsername,
            };

            await (await this.collection<SettingsDocument>(COLLECTIONS.settings)).updateOne(
                { _id: this.botUsername },
                { $set: document },
                { upsert: true },
            );

            return { ...config, botUsername: this.botUsername };
        } catch (error) {
            logger.error({ botUsername: this.botUsername, config, error }, 'Error saving bot config');
            throw error;
        }
    }

    async saveThread(thread: ThreadData): Promise<ThreadData> {
        try {
            const document: ThreadDocument = {
                ...thread,
                actualThreadId: thread.threadId,
                actualUserId: thread.userId,
                botUsername: this.botUsername,
                threadId: `${this.botUsername}#${thread.threadId}`,
                userId: `${this.botUsername}#${thread.userId}`,
            };

            await (await this.collection<ThreadDocument>(COLLECTIONS.threads)).updateOne(
                { botUsername: this.botUsername, threadId: `${this.botUsername}#${thread.threadId}` },
                { $set: document },
                { upsert: true },
            );

            return { ...thread, botUsername: this.botUsername };
        } catch (error) {
            logger.error({ botUsername: this.botUsername, error, thread }, 'Error saving thread');
            throw error;
        }
    }
}

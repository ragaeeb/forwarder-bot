import mongoose, { type Connection, type Model, Schema } from 'mongoose';

import type { BotSettings, SavedMessage, ThreadData } from '../../src/types/app.js';
import type { DataService } from '../../src/services/types.js';

// --- Schemas ---

const configSchema = new Schema(
    {
        ack: { type: String },
        adminGroupId: { type: String, required: true },
        configId: { type: String, default: 'main' },
        failure: { type: String },
        greeting: { type: String },
        setupAt: { type: String, required: true },
        setupBy: { type: Schema.Types.Mixed, required: true },
    },
    { _id: false, id: false },
);

const threadSchema = new Schema(
    {
        createdAt: { type: String, required: true },
        lastMessageAt: { type: String },
        lastMessageId: { type: String, default: '' },
        name: { type: String, required: true },
        threadId: { type: String, required: true },
        unreadCount: { type: Number, default: 0 },
        updatedAt: { type: String, required: true },
        userId: { type: String, required: true },
    },
    { _id: false },
);
threadSchema.index({ updatedAt: -1 });
threadSchema.index({ threadId: 1 });

const messageSchema = new Schema(
    {
        caption: { type: String },
        chatId: { type: String, required: true },
        forwardOrigin: { type: Schema.Types.Mixed },
        from: {
            firstName: { type: String },
            lastName: { type: String },
            userId: { type: String, required: true },
            username: { type: String },
        },
        id: { type: String, required: true },
        mediaId: { type: String },
        mediaType: { type: String },
        originalMessageId: { type: String },
        quote: { type: String },
        replyToMessageId: { type: String },
        text: { type: String, default: '' },
        timestamp: { type: String, required: true },
        type: { type: String, enum: ['user', 'admin', 'system'], required: true },
    },
    { _id: false },
);
messageSchema.index({ 'from.userId': 1, timestamp: -1 });

type ConfigDoc = BotSettings & { configId: string };

/**
 * MongoDB implementation of the DataService interface.
 */
export class MongoDBService implements DataService {
    private connection: Connection;
    private ConfigModel: Model<ConfigDoc>;
    private ThreadModel: Model<ThreadData>;
    private MessageModel: Model<SavedMessage>;

    constructor(uri: string) {
        this.connection = mongoose.createConnection(uri);
        this.ConfigModel = this.connection.model<ConfigDoc>('Config', configSchema, 'config');
        this.ThreadModel = this.connection.model<ThreadData>('Thread', threadSchema, 'threads');
        this.MessageModel = this.connection.model<SavedMessage>('Message', messageSchema, 'messages');
    }

    /**
     * Closes the MongoDB connection.
     */
    async close(): Promise<void> {
        await this.connection.close();
    }

    async getSettings(): Promise<BotSettings | undefined> {
        const doc = await this.ConfigModel.findOne({ configId: 'main' }).lean().exec();
        if (!doc) return undefined;
        const { configId: _configId, ...settings } = doc as any;
        return settings as BotSettings;
    }

    async saveSettings(settings: BotSettings): Promise<BotSettings> {
        await this.ConfigModel.findOneAndUpdate(
            { configId: 'main' },
            { ...settings, configId: 'main' },
            { upsert: true },
        ).exec();
        return settings;
    }

    async getThreadById(threadId: string): Promise<ThreadData | undefined> {
        const doc = await this.ThreadModel.findOne({ threadId }).lean().exec();
        if (!doc) return undefined;
        return doc as unknown as ThreadData;
    }

    async getThreadByUserId(userId: string): Promise<ThreadData | undefined> {
        const doc = await this.ThreadModel.findOne({ userId }).sort({ updatedAt: -1 }).lean().exec();
        if (!doc) return undefined;
        return doc as unknown as ThreadData;
    }

    async saveThread(thread: ThreadData): Promise<ThreadData> {
        await this.ThreadModel.findOneAndUpdate({ threadId: thread.threadId, userId: thread.userId }, thread, {
            upsert: true,
        }).exec();
        return thread;
    }

    async saveMessage(message: SavedMessage): Promise<SavedMessage> {
        await this.MessageModel.findOneAndUpdate({ id: message.id }, message, { upsert: true }).exec();
        return message;
    }

    async getMessagesByUserId(userId: string): Promise<SavedMessage[]> {
        const docs = await this.MessageModel.find({ 'from.userId': userId }).sort({ timestamp: -1 }).lean().exec();
        return docs as unknown as SavedMessage[];
    }

    async getAllThreads(options?: { limit?: number; offset?: number }): Promise<ThreadData[]> {
        const limit = options?.limit ?? 50;
        const offset = options?.offset ?? 0;
        const docs = await this.ThreadModel.find().sort({ updatedAt: -1 }).skip(offset).limit(limit).lean().exec();
        return docs as unknown as ThreadData[];
    }

    async getThreadCount(): Promise<number> {
        return this.ThreadModel.countDocuments().exec();
    }

    async getUnreadCount(userId: string): Promise<number> {
        const doc = await this.ThreadModel.findOne({ userId }).sort({ updatedAt: -1 }).lean().exec();
        if (!doc) return 0;
        return (doc as any).unreadCount ?? 0;
    }

    async markThreadRead(userId: string): Promise<void> {
        await this.ThreadModel.updateMany({ userId }, { $set: { unreadCount: 0 } }).exec();
    }
}

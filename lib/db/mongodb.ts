import mongoose, { type Document, type Model, model, Schema } from 'mongoose';

import type { DataService } from '@/services/types';
import type { BotSettings, SavedMessage, ThreadData } from '@/types/app';

const ConfigSchema = new Schema(
    {
        configId: { type: String, required: true, default: 'main' },
        adminGroupId: { type: String, required: true },
        ack: String,
        greeting: String,
        failure: String,
        setupAt: { type: String, required: true },
        setupBy: { type: Schema.Types.Mixed, required: true },
    },
    { _id: false, collection: 'config' },
);

const ThreadSchema = new Schema(
    {
        userId: { type: String, required: true },
        threadId: { type: String, required: true },
        name: { type: String, required: true },
        lastMessageId: String,
        unreadCount: { type: Number, default: 0 },
        createdAt: { type: String, required: true },
        updatedAt: { type: String, required: true },
    },
    { collection: 'threads' },
);

ThreadSchema.index({ userId: 1, threadId: 1 }, { unique: true });
ThreadSchema.index({ threadId: 1 });
ThreadSchema.index({ updatedAt: -1 });

const MessageSchema = new Schema(
    {
        id: { type: String, required: true, unique: true },
        userId: { type: String, required: true },
        chatId: { type: String, required: true },
        from: {
            userId: { type: String, required: true },
            firstName: String,
            lastName: String,
            username: String,
        },
        text: { type: String, default: '' },
        caption: String,
        mediaType: String,
        mediaId: String,
        forwardOrigin: Schema.Types.Mixed,
        quote: String,
        replyToMessageId: String,
        originalMessageId: String,
        type: { type: String, required: true, enum: ['user', 'admin', 'system'] },
        timestamp: { type: String, required: true },
    },
    { collection: 'messages' },
);

MessageSchema.index({ userId: 1, timestamp: -1 });

export interface MongoConfig {
    uri: string;
}

type ConfigDoc = Document & {
    configId: string;
    adminGroupId: string;
    ack?: string;
    greeting?: string;
    failure?: string;
    setupAt: string;
    setupBy: BotSettings['setupBy'];
};

type ThreadDoc = Document & {
    userId: string;
    threadId: string;
    name: string;
    lastMessageId: string;
    unreadCount: number;
    createdAt: string;
    updatedAt: string;
};

type MessageDoc = Document & {
    id: string;
    userId: string;
    chatId: string;
    from: SavedMessage['from'];
    text: string;
    caption?: string;
    mediaType?: string;
    mediaId?: string;
    forwardOrigin?: SavedMessage['forwardOrigin'];
    quote?: string;
    replyToMessageId?: string;
    originalMessageId?: string;
    type: 'user' | 'admin' | 'system';
    timestamp: string;
};

export class MongoDataService implements DataService {
    private uri: string;
    private ConfigModel: Model<ConfigDoc>;
    private ThreadModel: Model<ThreadDoc>;
    private MessageModel: Model<MessageDoc>;

    constructor(config: MongoConfig) {
        this.uri = config.uri;
        this.ConfigModel = model<ConfigDoc>('Config', ConfigSchema);
        this.ThreadModel = model<ThreadDoc>('Thread', ThreadSchema);
        this.MessageModel = model<MessageDoc>('Message', MessageSchema);
    }

    async connect(): Promise<void> {
        await mongoose.connect(this.uri);
    }

    async getMessagesByUserId(userId: string): Promise<SavedMessage[]> {
        const docs = await this.MessageModel.find({ userId }).sort({ timestamp: -1 }).lean().exec();
        return docs.map(docToSavedMessage);
    }

    async getSettings(): Promise<BotSettings | undefined> {
        const doc = await this.ConfigModel.findOne({ configId: 'main' }).lean().exec();
        if (!doc) return undefined;
        return docToBotSettings(doc);
    }

    async getThreadById(threadId: string): Promise<ThreadData | undefined> {
        const doc = await this.ThreadModel.findOne({ threadId }).lean().exec();
        if (!doc) return undefined;
        return docToThreadData(doc);
    }

    async getThreadByUserId(userId: string): Promise<ThreadData | undefined> {
        const doc = await this.ThreadModel.findOne({ userId }).sort({ updatedAt: -1 }).lean().exec();
        if (!doc) return undefined;
        return docToThreadData(doc);
    }

    async saveMessage(message: SavedMessage): Promise<SavedMessage> {
        const userId = message.from.userId;
        await this.MessageModel.updateOne(
            { id: message.id },
            {
                $set: {
                    id: message.id,
                    userId,
                    chatId: message.chatId,
                    from: message.from,
                    text: message.text,
                    caption: message.caption,
                    mediaType: message.mediaType,
                    mediaId: message.mediaId,
                    forwardOrigin: message.forwardOrigin,
                    quote: message.quote,
                    replyToMessageId: message.replyToMessageId,
                    originalMessageId: message.originalMessageId,
                    type: message.type,
                    timestamp: message.timestamp,
                },
            },
            { upsert: true },
        ).exec();
        return message;
    }

    async saveSettings(config: BotSettings): Promise<BotSettings> {
        await this.ConfigModel.updateOne(
            { configId: 'main' },
            {
                $set: {
                    configId: 'main',
                    adminGroupId: config.adminGroupId,
                    ack: config.ack,
                    greeting: config.greeting,
                    failure: config.failure,
                    setupAt: config.setupAt,
                    setupBy: config.setupBy,
                },
            },
            { upsert: true },
        ).exec();
        return config;
    }

    async saveThread(thread: ThreadData): Promise<ThreadData> {
        await this.ThreadModel.updateOne(
            { userId: thread.userId, threadId: thread.threadId },
            {
                $set: {
                    userId: thread.userId,
                    threadId: thread.threadId,
                    name: thread.name,
                    lastMessageId: thread.lastMessageId,
                    updatedAt: thread.updatedAt,
                },
                $setOnInsert: {
                    createdAt: thread.createdAt,
                    unreadCount: 0,
                },
            },
            { upsert: true },
        ).exec();
        return thread;
    }

    async getAllThreads(options?: { limit?: number; offset?: number }): Promise<ThreadData[]> {
        const limit = options?.limit ?? 100;
        const offset = options?.offset ?? 0;
        const docs = await this.ThreadModel.find().sort({ updatedAt: -1 }).skip(offset).limit(limit).lean().exec();
        return docs.map(docToThreadData);
    }

    async getThreadCount(): Promise<number> {
        return this.ThreadModel.countDocuments().exec();
    }

    async getUnreadCount(userId: string): Promise<number> {
        const result = await this.ThreadModel.aggregate([
            { $match: { userId } },
            { $group: { _id: null, total: { $sum: '$unreadCount' } } },
        ]).exec();
        return result[0]?.total ?? 0;
    }

    async markThreadRead(userId: string): Promise<void> {
        await this.ThreadModel.updateMany({ userId }, { $set: { unreadCount: 0 } }).exec();
    }
}

function docToBotSettings(doc: Record<string, any>): BotSettings {
    return {
        adminGroupId: String(doc.adminGroupId ?? ''),
        setupAt: String(doc.setupAt ?? ''),
        setupBy: doc.setupBy as BotSettings['setupBy'],
        ...(doc.ack && { ack: String(doc.ack) }),
        ...(doc.failure && { failure: String(doc.failure) }),
        ...(doc.greeting && { greeting: String(doc.greeting) }),
    };
}

function docToThreadData(doc: Record<string, any>): ThreadData {
    return {
        userId: String(doc.userId ?? ''),
        threadId: String(doc.threadId ?? ''),
        name: String(doc.name ?? ''),
        lastMessageId: String(doc.lastMessageId ?? ''),
        createdAt: String(doc.createdAt ?? ''),
        updatedAt: String(doc.updatedAt ?? ''),
    };
}

function docToSavedMessage(doc: Record<string, any>): SavedMessage {
    const from = doc.from as Record<string, any>;
    return {
        id: String(doc.id ?? ''),
        chatId: String(doc.chatId ?? ''),
        from: {
            userId: String(from?.userId ?? ''),
            ...(from?.firstName && { firstName: String(from.firstName) }),
            ...(from?.lastName && { lastName: String(from.lastName) }),
            ...(from?.username && { username: String(from.username) }),
        },
        text: String(doc.text ?? ''),
        timestamp: String(doc.timestamp ?? ''),
        type: (doc.type as 'admin' | 'user') ?? 'user',
        ...(doc.caption && { caption: String(doc.caption) }),
        ...(doc.mediaType && { mediaType: String(doc.mediaType) }),
        ...(doc.mediaId && { mediaId: String(doc.mediaId) }),
        ...(doc.forwardOrigin && { forwardOrigin: doc.forwardOrigin as SavedMessage['forwardOrigin'] }),
        ...(doc.quote && { quote: String(doc.quote) }),
        ...(doc.replyToMessageId && { replyToMessageId: String(doc.replyToMessageId) }),
        ...(doc.originalMessageId && { originalMessageId: String(doc.originalMessageId) }),
    };
}

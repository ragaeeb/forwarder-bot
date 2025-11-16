import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

import { MongoDataService } from '../src/services/mongodb.js';
import type { BotSettings, SavedMessage, ThreadData } from '../src/types/app.js';

const sanitizeHandle = (value: string): string => value.replace(/^@/, '');

const resolveBotUsername = (): string => {
    const raw = process.env.MIGRATION_BOT_USERNAME || process.env.BOT_USERNAME;

    if (!raw) {
        throw new Error('Set MIGRATION_BOT_USERNAME or BOT_USERNAME to the bot handle you want to migrate (without @).');
    }

    return sanitizeHandle(raw);
};

const botUsername = resolveBotUsername();
const legacyBotIdentifier = process.env.LEGACY_BOT_IDENTIFIER || process.env.LEGACY_BOT_TOKEN;
const normalizedLegacyId = legacyBotIdentifier ? sanitizeHandle(legacyBotIdentifier) : botUsername;

const baseTableName = process.env.TABLE_NAME || 'telegram-forwarder-bot-table';
const tableNames = {
    config: `${baseTableName}-config`,
    messages: `${baseTableName}-messages`,
    threads: `${baseTableName}-threads`,
} as const;

const region = process.env.AWS_REGION || 'us-east-1';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_KEY;

if (!accessKeyId || !secretAccessKey) {
    throw new Error('Set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY (or AWS_ACCESS_KEY/AWS_SECRET_KEY) so the migration can read DynamoDB.');
}

const dynamoClient = DynamoDBDocumentClient.from(
    new DynamoDBClient({
        credentials: { accessKeyId, secretAccessKey },
        region,
    }),
);

type DynamoItem = Record<string, any>;

const stripLegacyPrefix = (value?: string): string => {
    if (!value) {
        return '';
    }

    const candidatePrefixes = [botUsername, normalizedLegacyId]
        .filter(Boolean)
        .map((prefix) => `${prefix}#`);

    for (const prefix of candidatePrefixes) {
        if (value.startsWith(prefix)) {
            return value.slice(prefix.length);
        }
    }

    const hashIndex = value.indexOf('#');
    return hashIndex >= 0 ? value.slice(hashIndex + 1) : value;
};

const matchesBot = (value?: string): boolean => {
    if (!value) {
        return true;
    }

    const normalized = sanitizeHandle(String(value));
    return normalized === botUsername || normalized === normalizedLegacyId;
};

const scanAll = async (tableName: string): Promise<DynamoItem[]> => {
    const items: DynamoItem[] = [];
    let lastEvaluatedKey: DynamoItem | undefined;

    do {
        const result = await dynamoClient.send(
            new ScanCommand({
                ExclusiveStartKey: lastEvaluatedKey,
                TableName: tableName,
            }),
        );

        if (result.Items) {
            items.push(...(result.Items as DynamoItem[]));
        }

        lastEvaluatedKey = result.LastEvaluatedKey as DynamoItem | undefined;
    } while (lastEvaluatedKey);

    return items;
};

const normalizeMessage = (item: DynamoItem): SavedMessage | undefined => {
    if (!matchesBot(item.botUsername)) {
        return undefined;
    }

    const messageId = item.messageId || item.id;
    const chatId = item.chatId;
    const from = item.from || {};
    const actualUserId = item.actualUserId || from.userId || stripLegacyPrefix(item.userId);

    if (!messageId || !chatId || !actualUserId) {
        console.warn('Skipping message without id/chatId/userId', { chatId, messageId, actualUserId });
        return undefined;
    }

    return {
        botUsername,
        caption: item.caption,
        chatId: String(chatId),
        forwardOrigin: item.forwardOrigin,
        from: {
            firstName: from.firstName,
            lastName: from.lastName,
            userId: String(actualUserId),
            username: from.username,
        },
        id: String(messageId),
        mediaId: item.mediaId,
        mediaType: item.mediaType,
        originalMessageId: item.originalMessageId,
        quote: item.quote,
        replyToMessageId: item.replyToMessageId,
        text: item.text || '',
        timestamp: item.timestamp || new Date().toISOString(),
        type: item.type || 'user',
    } satisfies SavedMessage;
};

const normalizeThread = (item: DynamoItem): ThreadData | undefined => {
    if (!matchesBot(item.botUsername)) {
        return undefined;
    }

    const threadId = item.actualThreadId || stripLegacyPrefix(item.threadId);
    const userId = item.actualUserId || stripLegacyPrefix(item.userId);

    if (!threadId || !userId) {
        console.warn('Skipping thread without threadId/userId', { threadId, userId });
        return undefined;
    }

    const createdAt = item.createdAt || new Date().toISOString();

    return {
        botUsername,
        createdAt,
        lastMessageId: String(item.lastMessageId || '0'),
        name: item.name || `User ${userId}`,
        threadId: String(threadId),
        updatedAt: item.updatedAt || createdAt,
        userId: String(userId),
    } satisfies ThreadData;
};

const normalizeSettings = (items: DynamoItem[]): BotSettings | undefined => {
    const record = items.find((item) => matchesBot(item.botUsername));

    if (!record) {
        return undefined;
    }

    if (!record.adminGroupId) {
        console.warn('Found settings record without adminGroupId; skipping.');
        return undefined;
    }

    const setupBy = record.setupBy || {};

    return {
        ack: record.ack,
        adminGroupId: String(record.adminGroupId),
        botUsername,
        failure: record.failure,
        greeting: record.greeting,
        setupAt: record.setupAt || new Date().toISOString(),
        setupBy: {
            firstName: setupBy.firstName,
            lastName: setupBy.lastName,
            userId: String(setupBy.userId || setupBy.id || '0'),
            username: setupBy.username,
        },
    } satisfies BotSettings;
};

const migrate = async (): Promise<void> => {
    console.info(`Migrating DynamoDB data for @${botUsername} into MongoDB...`);

    const [rawMessages, rawThreads, rawSettings] = await Promise.all([
        scanAll(tableNames.messages),
        scanAll(tableNames.threads),
        scanAll(tableNames.config),
    ]);

    const messages = rawMessages.map(normalizeMessage).filter(Boolean) as SavedMessage[];
    const threads = rawThreads.map(normalizeThread).filter(Boolean) as ThreadData[];
    const settings = normalizeSettings(rawSettings);

    console.info(`Loaded ${messages.length} messages, ${threads.length} threads${settings ? '' : ' (no settings found)'}.`);

    const dataService = new MongoDataService(botUsername);

    for (const thread of threads) {
        await dataService.saveThread(thread);
    }

    for (const message of messages) {
        await dataService.saveMessage(message);
    }

    if (settings) {
        await dataService.saveSettings(settings);
    }

    console.info('Migration complete.');
};

migrate().catch((error) => {
    console.error('Migration failed', error);
    process.exit(1);
});

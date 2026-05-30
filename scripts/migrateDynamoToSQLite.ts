/**
 * Migration script: reads DynamoDB data and writes to SQLite.
 * Supports --dry-run (validate without writing) and --verbose (print each record).
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import type { BotSettings, SavedMessage, ThreadData } from '@/types/app.js';
import type { TelegramUser } from '@/types/telegram.js';
import { SQLiteDataService } from '../lib/db/sqlite.js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');

const TABLE_NAME = process.env.TABLE_NAME ?? 'telegram-forwarder-bot-table';
const SQLITE_PATH = process.env.SQLITE_PATH ?? './data/forwarder.db';

const configTable = `${TABLE_NAME}-config`;
const threadsTable = `${TABLE_NAME}-threads`;
const messagesTable = `${TABLE_NAME}-messages`;

const BATCH_SIZE = 100;

function createDynamoClient(): DynamoDBDocumentClient {
    const client = new DynamoDBClient({
        ...(process.env.AWS_ACCESS_KEY_ID && {
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
            },
        }),
        region: process.env.AWS_REGION ?? 'us-east-1',
    });
    return DynamoDBDocumentClient.from(client);
}

async function scanTable(client: DynamoDBDocumentClient, tableName: string): Promise<Record<string, unknown>[]> {
    const items: Record<string, unknown>[] = [];
    let lastKey: Record<string, unknown> | undefined;

    do {
        const response = await client.send(
            new ScanCommand({
                TableName: tableName,
                ExclusiveStartKey: lastKey,
            }),
        );
        if (response.Items) items.push(...(response.Items as Record<string, unknown>[]));
        lastKey = response.LastEvaluatedKey;
    } while (lastKey);

    return items;
}

function dynamoThreadToThreadData(item: Record<string, unknown>): ThreadData | null {
    const userId = item.userId as string | undefined;
    const threadId = item.threadId as string | undefined;
    const name = item.name as string | undefined;
    const lastMessageId = item.lastMessageId as string | undefined;
    const createdAt = item.createdAt as string | undefined;
    const updatedAt = item.updatedAt as string | undefined;

    if (!userId || !threadId || !name || !createdAt || !updatedAt) return null;

    return {
        userId,
        threadId,
        name,
        lastMessageId: lastMessageId ?? '',
        createdAt,
        updatedAt,
    };
}

function dynamoMessageToSavedMessage(item: Record<string, unknown>): SavedMessage | null {
    const messageId = (item.messageId ?? item.id) as string | undefined;
    const userId = item.userId as string | undefined;
    const chatId = item.chatId as string | undefined;
    const text = (item.text as string) ?? '';
    const timestamp = item.timestamp as string | undefined;
    const type = item.type as 'admin' | 'user' | undefined;

    if (!messageId || !userId || !chatId || !timestamp || !type) return null;

    const fromObj = item.from as Record<string, any> | undefined;
    const from: SavedMessage['from'] = { userId };
    const firstName = fromObj?.firstName ?? fromObj?.first_name;
    const lastName = fromObj?.lastName ?? fromObj?.last_name;
    if (firstName) from.firstName = String(firstName);
    if (lastName) from.lastName = String(lastName);
    if (fromObj?.username) from.username = String(fromObj.username);

    const msg: SavedMessage = {
        id: messageId,
        chatId,
        from,
        text,
        timestamp,
        type: type === 'admin' || type === 'user' ? type : 'user',
    };
    if (item.caption) msg.caption = String(item.caption);
    if (item.mediaType) msg.mediaType = String(item.mediaType);
    if (item.mediaId) msg.mediaId = String(item.mediaId);
    if (item.forwardOrigin) msg.forwardOrigin = item.forwardOrigin as SavedMessage['forwardOrigin'];
    if (item.quote) msg.quote = String(item.quote);
    if (item.replyToMessageId) msg.replyToMessageId = String(item.replyToMessageId);
    if (item.originalMessageId) msg.originalMessageId = String(item.originalMessageId);
    return msg;
}

function dynamoConfigToBotSettings(item: Record<string, unknown>): BotSettings | null {
    const adminGroupId = item.adminGroupId as string | undefined;
    const setupAt = item.setupAt as string | undefined;
    const setupBy = item.setupBy as TelegramUser | undefined;

    if (!adminGroupId || !setupAt || !setupBy) return null;

    const result: BotSettings = { adminGroupId, setupAt, setupBy };
    if (item.ack) result.ack = String(item.ack);
    if (item.greeting) result.greeting = String(item.greeting);
    if (item.failure) result.failure = String(item.failure);
    return result;
}

async function main() {
    console.log(`Migration: DynamoDB → SQLite`);
    console.log(`  Tables: ${configTable}, ${threadsTable}, ${messagesTable}`);
    console.log(`  SQLite: ${SQLITE_PATH}`);
    console.log(`  Mode: ${dryRun ? 'DRY RUN (no writes)' : 'LIVE'}`);
    if (verbose) console.log(`  Verbose: ON`);
    console.log('');

    const client = createDynamoClient();
    const db = dryRun ? null : new SQLiteDataService(SQLITE_PATH);

    let threadsMigrated = 0;
    let messagesMigrated = 0;
    let configMigrated = 0;
    const failedThreads: unknown[] = [];
    const failedMessages: unknown[] = [];
    const failedConfigs: unknown[] = [];

    // Migrate config
    console.log('Scanning config table...');
    const configItems = await scanTable(client, configTable);
    console.log(`  Found ${configItems.length} config record(s)`);

    for (const item of configItems) {
        const settings = dynamoConfigToBotSettings(item);
        if (!settings) {
            failedConfigs.push(item);
            if (verbose) console.log('  [SKIP] config:', JSON.stringify(item));
            continue;
        }
        if (verbose) console.log('  config:', settings.adminGroupId);
        if (db) {
            try {
                await db.saveSettings(settings);
                configMigrated++;
            } catch (err) {
                failedConfigs.push(item);
                console.error('  [FAIL] config:', err);
            }
        } else {
            configMigrated++;
        }
    }

    // Migrate threads
    console.log('Scanning threads table...');
    const threadItems = await scanTable(client, threadsTable);
    console.log(`  Found ${threadItems.length} thread(s)`);

    for (let i = 0; i < threadItems.length; i += BATCH_SIZE) {
        const batch = threadItems.slice(i, i + BATCH_SIZE);
        for (const item of batch) {
            const thread = dynamoThreadToThreadData(item);
            if (!thread) {
                failedThreads.push(item);
                if (verbose) console.log('  [SKIP] thread:', JSON.stringify(item));
                continue;
            }
            if (verbose) console.log('  thread:', thread.threadId, thread.name);
            if (db) {
                try {
                    await db.saveThread(thread);
                    threadsMigrated++;
                } catch (err) {
                    failedThreads.push(item);
                    console.error('  [FAIL] thread:', thread.threadId, err);
                }
            } else {
                threadsMigrated++;
            }
        }
    }

    // Migrate messages
    console.log('Scanning messages table...');
    const messageItems = await scanTable(client, messagesTable);
    console.log(`  Found ${messageItems.length} message(s)`);

    for (let i = 0; i < messageItems.length; i += BATCH_SIZE) {
        const batch = messageItems.slice(i, i + BATCH_SIZE);
        for (const item of batch) {
            const message = dynamoMessageToSavedMessage(item);
            if (!message) {
                failedMessages.push(item);
                if (verbose) console.log('  [SKIP] message:', JSON.stringify(item));
                continue;
            }
            if (verbose) console.log('  message:', message.id, message.type);
            if (db) {
                try {
                    await db.saveMessage(message);
                    messagesMigrated++;
                } catch (err) {
                    failedMessages.push(item);
                    console.error('  [FAIL] message:', message.id, err);
                }
            } else {
                messagesMigrated++;
            }
        }
    }

    // Summary
    console.log('');
    console.log('--- Summary ---');
    console.log(`Migrated: ${threadsMigrated} threads, ${messagesMigrated} messages, ${configMigrated} config records`);

    if (failedThreads.length > 0) {
        console.log(`Failed threads: ${failedThreads.length}`);
        for (const f of failedThreads) console.log('  ', JSON.stringify(f));
    }
    if (failedMessages.length > 0) {
        console.log(`Failed messages: ${failedMessages.length}`);
        for (const f of failedMessages) console.log('  ', JSON.stringify(f));
    }
    if (failedConfigs.length > 0) {
        console.log(`Failed configs: ${failedConfigs.length}`);
        for (const f of failedConfigs) console.log('  ', JSON.stringify(f));
    }

    if (dryRun) {
        console.log('');
        console.log('Dry run complete. Run without --dry-run to perform migration.');
    }
}

main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});

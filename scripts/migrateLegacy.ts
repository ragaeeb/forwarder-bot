import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchWriteCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import type { SavedMessage, ThreadData } from '../src/types/app';

interface Thread extends ThreadData {
    messages: SavedMessage[];
}

const BASE_TABLE_NAME = process.env.TABLE_NAME || 'telegram-forwarder-bot-table';
const THREADS_TABLE = `${BASE_TABLE_NAME}-threads`;
const MESSAGES_TABLE = `${BASE_TABLE_NAME}-messages`;

const BATCH_SIZE = 25; // DynamoDB batch write limit

const client = new DynamoDBClient({
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY as string,
        secretAccessKey: process.env.AWS_SECRET_KEY as string,
    },
    region: 'us-east-1',
});

const ddbDocClient = DynamoDBDocumentClient.from(client);

async function migrateMessages(threads: Thread[]) {
    const allMessages: (SavedMessage & { userId: string })[] = [];

    for (const thread of threads) {
        for (const message of thread.messages) {
            allMessages.push({
                ...message,
                userId: thread.userId,
            });
        }
    }

    console.log(`Migrating ${allMessages.length} messages to ${MESSAGES_TABLE}...`);
    let migratedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < allMessages.length; i += BATCH_SIZE) {
        const batch = allMessages.slice(i, i + BATCH_SIZE);

        try {
            const batchItems = batch.map((message) => ({
                PutRequest: {
                    Item: {
                        chatId: message.chatId,
                        from: message.from,
                        messageId: message.id,
                        text: message.text || '',
                        timestamp: message.timestamp,
                        type: message.type,
                        userId: message.userId,
                        ...(message.mediaId && { mediaId: message.mediaId }),
                        ...(message.mediaType && { mediaType: message.mediaType }),
                        ...(message.quote && { quote: message.quote }),
                        ...(message.replyToMessageId && { replyToMessageId: message.replyToMessageId }),
                    },
                },
            }));

            await ddbDocClient.send(
                new BatchWriteCommand({
                    RequestItems: {
                        [MESSAGES_TABLE]: batchItems,
                    },
                }),
            );

            migratedCount += batch.length;
            console.log(
                `Message batch ${Math.ceil((i + 1) / BATCH_SIZE)}/${Math.ceil(allMessages.length / BATCH_SIZE)} migrated successfully`,
            );
        } catch (error) {
            console.error(`Failed to migrate message batch ${Math.ceil((i + 1) / BATCH_SIZE)}:`, error);
            failedCount += batch.length;
        }
    }

    console.log(`Message migration complete. Migrated: ${migratedCount}, Failed: ${failedCount}`);
}

async function migrateThreads(threads: Thread[]) {
    console.log(`Migrating ${threads.length} threads to ${THREADS_TABLE}...`);
    let migratedCount = 0;
    let failedCount = 0;

    // Process threads in batches
    for (let i = 0; i < threads.length; i += BATCH_SIZE) {
        const batch = threads.slice(i, i + BATCH_SIZE);

        try {
            const batchItems = batch.map((thread) => ({
                PutRequest: {
                    Item: {
                        chatId: thread.messages.length > 0 ? thread.messages[0].chatId : thread.userId,
                        createdAt: thread.createdAt || new Date().toISOString(),
                        lastMessageId: thread.lastMessageId || '0',
                        name: thread.name,
                        threadId: thread.threadId,
                        updatedAt: thread.updatedAt || new Date().toISOString(),
                        userId: thread.userId,
                    },
                },
            }));

            await ddbDocClient.send(
                new BatchWriteCommand({
                    RequestItems: {
                        [THREADS_TABLE]: batchItems,
                    },
                }),
            );

            migratedCount += batch.length;
            console.log(
                `Thread batch ${Math.ceil((i + 1) / BATCH_SIZE)}/${Math.ceil(threads.length / BATCH_SIZE)} migrated successfully`,
            );
        } catch (error) {
            console.error(`Failed to migrate thread batch ${Math.ceil((i + 1) / BATCH_SIZE)}:`, error);
            failedCount += batch.length;
        }
    }

    console.log(`Thread migration complete. Migrated: ${migratedCount}, Failed: ${failedCount}`);
}

async function migrateToDb() {
    console.log('Starting migration to separate tables...');

    try {
        const threads: Thread[] = await Bun.file('threadsAndMessages.json').json();

        console.log(`Loaded ${threads.length} threads with messages`);

        await migrateThreads(threads);
        await migrateMessages(threads);

        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
    }
}

migrateToDb();

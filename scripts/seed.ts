/**
 * Seed script: populates the SQLite DB with sample data for development.
 */

import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { BotSettings, SavedMessage, ThreadData } from '@/types/app.js';
import { SQLiteDataService } from '../lib/db/sqlite.js';

const SQLITE_PATH = process.env.SQLITE_PATH ?? './data/forwarder.db';

const SAMPLE_THREADS: Omit<ThreadData, 'lastMessageId'>[] = [
    {
        userId: '1001',
        threadId: 't-1',
        name: 'Alice Johnson',
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-02-20T14:30:00Z',
    },
    {
        userId: '1002',
        threadId: 't-2',
        name: 'Bob Smith',
        createdAt: '2024-01-20T09:15:00Z',
        updatedAt: '2024-02-25T11:45:00Z',
    },
    {
        userId: '1003',
        threadId: 't-3',
        name: 'Carol Williams',
        createdAt: '2024-02-01T16:00:00Z',
        updatedAt: '2024-02-26T09:00:00Z',
    },
];

function makeMessages(thread: ThreadData): SavedMessage[] {
    const base = new Date(thread.createdAt).getTime();
    const messages: SavedMessage[] = [];

    const userMessages = [
        'Hi, I need help with my order.',
        "I placed an order 3 days ago but haven't received a tracking number.",
        'Order #12345',
        'Can you check the status for me?',
        'Thanks for looking into it!',
        'Is there any update?',
        "I'm available anytime for a callback.",
    ];

    const adminReplies = [
        "Hello! I'll look into this right away.",
        'I found your order. Let me get the tracking details.',
        'Your package shipped yesterday. Tracking: 1Z999AA10123456784',
        'You should receive it by Friday. Anything else I can help with?',
        "You're welcome! Have a great day.",
    ];

    const numMessages = 8; // 5-10 range
    for (let i = 0; i < numMessages; i++) {
        const isUser = i % 2 === 0;
        const text = isUser
            ? userMessages[Math.min(Math.floor(i / 2), userMessages.length - 1)]
            : adminReplies[Math.min(Math.floor((i - 1) / 2), adminReplies.length - 1)];
        const ts = new Date(base + i * 3600000).toISOString();
        messages.push({
            id: `msg-${thread.threadId}-${i + 1}`,
            chatId: '-1001234567890',
            from: {
                userId: isUser ? thread.userId : 'admin-1',
                ...(isUser
                    ? { firstName: thread.name.split(' ')[0] }
                    : { firstName: 'Support', username: 'support_bot' }),
            },
            text,
            timestamp: ts,
            type: isUser ? 'user' : 'admin',
        });
    }
    return messages;
}

const SAMPLE_CONFIG: BotSettings = {
    adminGroupId: '-1001234567890',
    setupAt: '2024-01-01T00:00:00Z',
    setupBy: {
        id: 999888777,
        first_name: 'Admin',
        last_name: 'User',
        username: 'admin_user',
        is_bot: false,
    },
    ack: "Message received. We'll get back to you shortly.",
    greeting: 'Welcome! How can we help you today?',
    failure: 'Sorry, something went wrong. Please try again later.',
};

async function main() {
    await mkdir(dirname(SQLITE_PATH), { recursive: true });

    const db = new SQLiteDataService(SQLITE_PATH);

    // Seed config
    await db.saveSettings(SAMPLE_CONFIG);
    console.log('Seeded: 1 BotSettings config');

    // Seed threads and messages
    let threadCount = 0;
    let messageCount = 0;

    for (const t of SAMPLE_THREADS) {
        const thread: ThreadData = {
            ...t,
            lastMessageId: `msg-${t.threadId}-8`,
        };
        await db.saveThread(thread);
        threadCount++;

        const messages = makeMessages(thread);
        for (const msg of messages) {
            await db.saveMessage(msg);
            messageCount++;
        }
    }

    console.log(`Seeded: ${threadCount} threads`);
    console.log(`Seeded: ${messageCount} messages`);
    console.log('');
    console.log('Summary: 1 config, 3 threads, 24 messages (8 per thread)');
}

main().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
});

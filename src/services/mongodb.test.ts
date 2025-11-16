import type { BotSettings, SavedMessage, ThreadData } from '@/types/app.js';

import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

describe('MongoDataService', () => {
    const BOT_USERNAME = 'testbot';
    let mongoServer: MongoMemoryServer;
    let MongoDataService: typeof import('./mongodb.js').MongoDataService;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        process.env.MONGODB_URI = mongoServer.getUri();
        process.env.MONGODB_DB = 'forwarder-bot-tests';
        process.env.DATABASE_PROVIDER = 'mongodb';
    });

    afterAll(async () => {
        await mongoServer.stop();
    });

    beforeEach(async () => {
        vi.resetModules();
        const module = await import('./mongodb.js');
        MongoDataService = module.MongoDataService;

        const client = await MongoClient.connect(process.env.MONGODB_URI!);
        await client.db(process.env.MONGODB_DB!).dropDatabase().catch(() => {});
        await client.close();
    });

    it('saves and retrieves settings scoped to the bot username', async () => {
        const service = new MongoDataService(BOT_USERNAME);

        const settings: BotSettings = {
            adminGroupId: 'admin-1',
            botUsername: BOT_USERNAME,
            setupAt: new Date().toISOString(),
            setupBy: { first_name: 'Admin', id: 1, is_bot: false },
        };

        await service.saveSettings(settings);
        const stored = await service.getSettings();

        expect(stored).toMatchObject(settings);
    });

    it('stores threads with prefixed identifiers and retrieves them by user id', async () => {
        const service = new MongoDataService(BOT_USERNAME);
        const thread: ThreadData = {
            botUsername: BOT_USERNAME,
            createdAt: new Date().toISOString(),
            lastMessageId: '123',
            name: 'Support',
            threadId: 'thread-1',
            updatedAt: new Date().toISOString(),
            userId: 'user-1',
        };

        await service.saveThread(thread);

        const fetched = await service.getThreadByUserId('user-1');
        expect(fetched).toMatchObject(thread);
    });

    it('stores messages and queries them in reverse chronological order', async () => {
        const service = new MongoDataService(BOT_USERNAME);
        const older: SavedMessage = {
            botUsername: BOT_USERNAME,
            chatId: 'chat-1',
            from: { userId: 'user-1' },
            id: 'msg-1',
            text: 'first',
            timestamp: '2024-01-01T00:00:00Z',
            type: 'user',
        };
        const newer: SavedMessage = {
            ...older,
            id: 'msg-2',
            text: 'second',
            timestamp: '2024-01-02T00:00:00Z',
        };

        await service.saveMessage(older);
        await service.saveMessage(newer);

        const messages = await service.getMessagesByUserId('user-1');
        expect(messages.map((msg) => msg.id)).toEqual(['msg-2', 'msg-1']);
    });
});

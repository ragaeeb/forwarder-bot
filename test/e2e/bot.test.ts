import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Bot } from '../../src/bot';
import { config } from '../../src/config';
import { registerHandlers } from '../../src/handlers';
import { MockDataService } from '../../src/services/mockDataService';
import { TelegramTestServer } from './telegramServer';

describe('Telegram Bot E2E Tests', () => {
    // Mock environment variables
    vi.mock('../../src/config', () => ({
        config: {
            BOT_TOKEN: 'test_token',
            SECRET_TOKEN: 'test_secret',
            TABLE_NAME: 'test-table',
        },
    }));

    let telegramServer: TelegramTestServer;
    let uninstall: () => void;
    let bot: Bot;
    let db: MockDataService;

    beforeEach(async () => {
        // Setup mock Telegram server
        telegramServer = new TelegramTestServer({
            first_name: 'Test Bot',
            id: 12345,
            username: 'test_bot',
        });

        // Install mock server
        uninstall = telegramServer.install();

        // Create bot and database instances
        bot = new Bot(config.BOT_TOKEN);
        db = new MockDataService();

        // Register handlers
        await registerHandlers(bot, db);
    });

    afterEach(() => {
        // Uninstall mock server
        uninstall();

        // Clear any timeouts
        vi.clearAllTimers();
    });

    it('should handle a direct message from a user', async () => {
        // Simulate a user message
        const userMessage = telegramServer.createUserMessage({
            firstName: 'Test',
            text: 'Hello bot!',
            userId: 123456,
            username: 'testuser',
        });

        // First, ensure bot is configured
        await setupBotWithAdmin();

        // Clear previous requests
        telegramServer.clearRequests();

        // Send the update to the bot
        await bot.handleUpdate(userMessage);

        // Check requests
        const requests = telegramServer.getRequests();

        // Should call createForumTopic (for new user)
        expect(requests.some((req) => req.method === 'createForumTopic')).toBe(true);

        // Should forward the message to admin group
        expect(requests.some((req) => req.method === 'forwardMessage')).toBe(true);

        // Should send acknowledgment to user
        const sendMessageRequest = requests.find(
            (req) => req.method === 'sendMessage' && req.params.chat_id === 123456,
        );
        expect(sendMessageRequest).toBeDefined();
    });

    it('should handle admin reply to user', async () => {
        // First, ensure bot is configured
        const adminGroupId = await setupBotWithAdmin();

        // Save a mock thread
        await db.saveThread({
            chatId: '123456',
            createdAt: new Date().toISOString(),
            lastMessageId: '456',
            name: 'Test User',
            threadId: '789',
            updatedAt: new Date().toISOString(),
            userId: '123456',
        });

        // Clear previous requests
        telegramServer.clearRequests();

        // Simulate admin reply message
        const adminReply = telegramServer.createUserMessage({
            chatId: Number(adminGroupId),
            firstName: 'Admin',
            isGroupChat: true,
            text: 'This is a reply to the user',
            userId: 654321,
        });

        // Add thread_id and reply_to_message to simulate reply in thread
        adminReply.message!.message_thread_id = 789;
        adminReply.message!.reply_to_message = {
            chat: { id: Number(adminGroupId), type: 'supergroup' },
            date: Math.floor(Date.now() / 1000),
            from: { first_name: 'User', id: 123456, is_bot: false },
            message_id: 456,
            text: 'Original message',
        };

        // Send the update to the bot
        await bot.handleUpdate(adminReply);

        // Check requests
        const requests = telegramServer.getRequests();

        // Should send message to user
        const sendMessageRequest = requests.find(
            (req) => req.method === 'sendMessage' && req.params.chat_id === 123456,
        );
        expect(sendMessageRequest).toBeDefined();
        expect(sendMessageRequest?.params.text).toBe('This is a reply to the user');

        // Should send confirmation to admin
        const confirmRequest = requests.find(
            (req) =>
                req.method === 'sendMessage' &&
                req.params.chat_id === Number(adminGroupId) &&
                req.params.text.includes('Reply sent to user'),
        );
        expect(confirmRequest).toBeDefined();
    });

    it('should handle /start command', async () => {
        // First, ensure bot is configured
        await setupBotWithAdmin();

        // Clear previous requests
        telegramServer.clearRequests();

        // Simulate /start command
        const startCommand = telegramServer.createUserMessage({
            firstName: 'Test',
            text: '/start',
            userId: 123456,
            username: 'testuser',
        });

        // Send the update to the bot
        await bot.handleUpdate(startCommand);

        // Check requests
        const requests = telegramServer.getRequests();

        // Should send welcome message
        const sendMessageRequest = requests.find(
            (req) => req.method === 'sendMessage' && req.params.chat_id === 123456,
        );
        expect(sendMessageRequest).toBeDefined();
        expect(sendMessageRequest?.params.text).toContain('communicate with our team');
    });

    /**
     * Helper to setup the bot with admin configuration
     */
    async function setupBotWithAdmin() {
        const adminGroupId = '-100987654321';

        // Save configuration to database
        await db.saveSettings({
            adminGroupId,
            configId: 'main',
            setupAt: new Date().toISOString(),
            setupBy: {
                first_name: 'Admin',
                id: 654321,
                is_bot: false,
            },
        });

        return adminGroupId;
    }
});

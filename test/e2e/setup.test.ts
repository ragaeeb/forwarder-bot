import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Bot } from '../../src/bot';
import { config } from '../../src/config';
import { registerHandlers } from '../../src/handlers';
import { MockDataService } from '../../src/services/mockDataService';
import { hashToken } from '../../src/utils/security';
import { TelegramTestServer } from './telegramServer';

describe('Bot Setup E2E Tests', () => {
    // Mock environment variables
    vi.mock('../../src/config', () => ({
        config: {
            BOT_TOKEN: 'test_token',
            SECRET_TOKEN: 'test_secret',
            TABLE_NAME: 'test-table',
        },
    }));

    // Mock the security hashToken function
    vi.mock('../../src/utils/security', () => ({
        hashToken: vi.fn().mockReturnValue('hashed_test_token'),
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

        // Initialize bot
        await bot.init();
    });

    afterEach(() => {
        // Uninstall mock server
        uninstall();

        // Clear any timeouts
        vi.clearAllTimers();
    });

    it('should handle /setup command with valid token and permissions', async () => {
        // Configure server to respond to admin check
        telegramServer.setResponse('getChatMember', () => ({
            status: 'administrator',
            user: { first_name: 'Admin', id: 654321, is_bot: false },
        }));

        // Simulate setup command in a supergroup
        const setupCommand = telegramServer.createUserMessage({
            chatId: -987654321,
            firstName: 'Admin',
            isGroupChat: true,
            text: `/setup ${hashToken(config.BOT_TOKEN)}`,
            userId: 654321,
        });

        // Clear previous requests
        telegramServer.clearRequests();

        // Send the update to the bot
        await bot.handleUpdate(setupCommand);

        // Check requests
        const requests = telegramServer.getRequests();

        // Should check if user is admin
        expect(requests.some((req) => req.method === 'getChatMember')).toBe(true);

        // Should create test topic to verify permissions
        expect(requests.some((req) => req.method === 'createForumTopic')).toBe(true);

        // Should delete test topic
        expect(requests.some((req) => req.method === 'deleteForumTopic')).toBe(true);

        // Should send success message
        const successMessage = requests.find(
            (req) => req.method === 'sendMessage' && req.params.text.includes('Setup complete'),
        );
        expect(successMessage).toBeDefined();

        // Should save settings to database
        const settings = await db.getSettings();
        expect(settings).toBeDefined();
        expect(settings?.adminGroupId).toBe('-987654321');
    });

    it('should reject /setup command from non-admin user', async () => {
        // Configure server to respond to admin check as non-admin
        telegramServer.setResponse('getChatMember', () => ({
            status: 'member',
            user: { first_name: 'NonAdmin', id: 654321, is_bot: false },
        }));

        // Simulate setup command in a supergroup
        const setupCommand = telegramServer.createUserMessage({
            chatId: -987654321,
            firstName: 'NonAdmin',
            isGroupChat: true,
            text: `/setup ${hashToken(config.BOT_TOKEN)}`,
            userId: 654321,
        });

        // Clear previous requests
        telegramServer.clearRequests();

        // Send the update to the bot
        await bot.handleUpdate(setupCommand);

        // Check requests
        const requests = telegramServer.getRequests();

        // Should check if user is admin
        expect(requests.some((req) => req.method === 'getChatMember')).toBe(true);

        // Should NOT create test topic
        expect(requests.some((req) => req.method === 'createForumTopic')).toBe(false);

        // Should send warning message
        const warningMessage = requests.find(
            (req) => req.method === 'sendMessage' && req.params.text.includes('Only group administrators'),
        );
        expect(warningMessage).toBeDefined();

        // Should NOT save settings to database
        const settings = await db.getSettings();
        expect(settings).toBeUndefined();
    });

    it('should reject /setup command with invalid token', async () => {
        // Simulate setup command with wrong token
        const setupCommand = telegramServer.createUserMessage({
            chatId: -987654321,
            firstName: 'Admin',
            isGroupChat: true,
            text: `/setup invalid_token`,
            userId: 654321,
        });

        // Clear previous requests
        telegramServer.clearRequests();

        // Send the update to the bot
        await bot.handleUpdate(setupCommand);

        // Check requests
        const requests = telegramServer.getRequests();

        // Should NOT check if user is admin or do anything else
        expect(requests.length).toBe(0);

        // Should NOT save settings to database
        const settings = await db.getSettings();
        expect(settings).toBeUndefined();
    });

    it('should handle reconfiguration to a new group', async () => {
        // First configure the bot with one group
        await db.saveSettings({
            adminGroupId: '-100123456789',
            configId: 'main',
            setupAt: new Date().toISOString(),
            setupBy: {
                first_name: 'Admin',
                id: 654321,
                is_bot: false,
            },
        });

        // Configure server to respond to admin check
        telegramServer.setResponse('getChatMember', () => ({
            status: 'administrator',
            user: { first_name: 'Admin', id: 654321, is_bot: false },
        }));

        // Simulate setup command in a NEW supergroup
        const setupCommand = telegramServer.createUserMessage({
            chatId: -987654321, // Different group ID
            firstName: 'Admin',
            isGroupChat: true,
            text: `/setup ${hashToken(config.BOT_TOKEN)}`,
            userId: 654321,
        });

        // Clear previous requests
        telegramServer.clearRequests();

        // Send the update to the bot
        await bot.handleUpdate(setupCommand);

        // Check requests
        const requests = telegramServer.getRequests();

        // Should send warning to deactivate old group
        const warningMessage = requests.find(
            (req) => req.method === 'sendMessage' && req.params.text.includes('reconfigured'),
        );
        expect(warningMessage).toBeDefined();

        // Should try to leave old chat
        expect(requests.some((req) => req.method === 'leaveChat')).toBe(true);

        // Should test and create topic in new group
        expect(requests.some((req) => req.method === 'createForumTopic')).toBe(true);

        // Should save updated settings
        const settings = await db.getSettings();
        expect(settings).toBeDefined();
        expect(settings?.adminGroupId).toBe('-987654321');
    });
});

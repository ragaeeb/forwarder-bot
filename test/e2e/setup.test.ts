import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Bot } from '../../src/bot';
import { config } from '../../src/config';
import { registerHandlers } from '../../src/handlers';
import { MockDataService } from '../../src/services/mockDataService';
import { hashToken } from '../../src/utils/security';
import { TelegramTestServer } from './telegramServer';

describe('Bot Setup E2E Tests', () => {
    vi.mock('../../src/utils/security', () => ({
        hashToken: vi.fn().mockReturnValue('hashed_test_token'),
    }));

    let telegramServer: TelegramTestServer;
    let uninstall: () => void;
    let bot: Bot;
    let db: MockDataService;

    beforeEach(async () => {
        telegramServer = new TelegramTestServer({
            first_name: 'Test Bot',
            id: 12345,
            username: 'test_bot',
        });

        uninstall = telegramServer.install();

        bot = new Bot(config.BOT_TOKEN);
        db = new MockDataService();

        await registerHandlers(bot, db);
    });

    afterEach(() => {
        uninstall();
        vi.clearAllTimers();
    });

    it('should handle /setup command with valid token and permissions', async () => {
        telegramServer.setResponse('getChatMember', () => ({
            status: 'administrator',
            user: { first_name: 'Admin', id: 654321, is_bot: false },
        }));

        const setupCommand = telegramServer.createUserMessage({
            chatId: -987654321,
            firstName: 'Admin',
            isGroupChat: true,
            text: `/setup ${hashToken(config.BOT_TOKEN)}`,
            userId: 654321,
        });

        telegramServer.clearRequests();

        await bot.handleUpdate(setupCommand);

        const requests = telegramServer.getRequests();

        expect(requests.some((req) => req.method === 'getChatMember')).toBe(true);
        expect(requests.some((req) => req.method === 'createForumTopic')).toBe(true);
        expect(requests.some((req) => req.method === 'deleteForumTopic')).toBe(true);

        const successMessage = requests.find(
            (req) => req.method === 'sendMessage' && req.params.text.includes('Setup complete'),
        );
        expect(successMessage).toBeDefined();

        const settings = await db.getSettings();
        expect(settings).toBeDefined();
        expect(settings?.adminGroupId).toBe('-987654321');
    });

    it('should reject /setup command from non-admin user', async () => {
        telegramServer.setResponse('getChatMember', () => ({
            status: 'member',
            user: { first_name: 'NonAdmin', id: 654321, is_bot: false },
        }));

        const setupCommand = telegramServer.createUserMessage({
            chatId: -987654321,
            firstName: 'NonAdmin',
            isGroupChat: true,
            text: `/setup ${hashToken(config.BOT_TOKEN)}`,
            userId: 654321,
        });

        telegramServer.clearRequests();

        await bot.handleUpdate(setupCommand);

        const requests = telegramServer.getRequests();

        expect(requests.some((req) => req.method === 'getChatMember')).toBe(true);
        expect(requests.some((req) => req.method === 'createForumTopic')).toBe(false);

        const warningMessage = requests.find(
            (req) => req.method === 'sendMessage' && req.params.text.includes('Only group administrators'),
        );
        expect(warningMessage).toBeDefined();

        const settings = await db.getSettings();
        expect(settings).toBeUndefined();
    });

    it('should reject /setup command with invalid token', async () => {
        const setupCommand = telegramServer.createUserMessage({
            chatId: -987654321,
            firstName: 'Admin',
            isGroupChat: true,
            text: `/setup invalid_token`,
            userId: 654321,
        });

        telegramServer.clearRequests();

        await bot.handleUpdate(setupCommand);

        const requests = telegramServer.getRequests();

        expect(requests.length).toBe(0);

        const settings = await db.getSettings();
        expect(settings).toBeUndefined();
    });

    it('should handle reconfiguration to a new group', async () => {
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

        telegramServer.setResponse('getChatMember', () => ({
            status: 'administrator',
            user: { first_name: 'Admin', id: 654321, is_bot: false },
        }));

        const setupCommand = telegramServer.createUserMessage({
            chatId: -987654321, // Different group ID
            firstName: 'Admin',
            isGroupChat: true,
            text: `/setup ${hashToken(config.BOT_TOKEN)}`,
            userId: 654321,
        });

        telegramServer.clearRequests();

        await bot.handleUpdate(setupCommand);

        const requests = telegramServer.getRequests();

        const warningMessage = requests.find(
            (req) => req.method === 'sendMessage' && req.params.text.includes('reconfigured'),
        );
        expect(warningMessage).toBeDefined();

        expect(requests.some((req) => req.method === 'leaveChat')).toBe(true);
        expect(requests.some((req) => req.method === 'createForumTopic')).toBe(true);

        const settings = await db.getSettings();
        expect(settings).toBeDefined();
        expect(settings?.adminGroupId).toBe('-987654321');
    });

    it('should reject /setup in a normal group without topics', async () => {
        telegramServer.setResponse('getChatMember', () => ({
            status: 'administrator',
            user: { first_name: 'Admin', id: 654321, is_bot: false },
        }));

        const setupCommand = telegramServer.createUserMessage({
            chatId: -987654321,
            firstName: 'Admin',
            isGroupChat: true,
            text: `/setup ${hashToken(config.BOT_TOKEN)}`,
            userId: 654321,
        });

        // Override type to be 'group' instead of 'supergroup'
        setupCommand.message!.chat.type = 'group';

        telegramServer.clearRequests();

        await bot.handleUpdate(setupCommand);

        const requests = telegramServer.getRequests();

        const warningMessage = requests.find(
            (req) => req.method === 'sendMessage' && req.params.text.includes('must be used in a group with topics'),
        );
        expect(warningMessage).toBeDefined();

        const settings = await db.getSettings();
        expect(settings).toBeUndefined();
    });

    it('should handle setup failure when bot cannot manage topics', async () => {
        telegramServer.setResponse('getChatMember', () => ({
            status: 'administrator',
            user: { first_name: 'Admin', id: 654321, is_bot: false },
        }));

        // Make createForumTopic fail
        telegramServer.setResponse('createForumTopic', () => {
            throw new Error('Bot cannot create topics');
        });

        const setupCommand = telegramServer.createUserMessage({
            chatId: -987654321,
            firstName: 'Admin',
            isGroupChat: true,
            text: `/setup ${hashToken(config.BOT_TOKEN)}`,
            userId: 654321,
        });

        telegramServer.clearRequests();

        await bot.handleUpdate(setupCommand);

        const requests = telegramServer.getRequests();

        expect(requests.some((req) => req.method === 'getChatMember')).toBe(true);

        const errorMessage = requests.find(
            (req) => req.method === 'sendMessage' && req.params.text.includes('Setup failed'),
        );
        expect(errorMessage).toBeDefined();

        const settings = await db.getSettings();
        expect(settings).toBeUndefined();
    });

    it('should handle attempt to setup in the same group multiple times', async () => {
        // First setup the group
        await db.saveSettings({
            adminGroupId: '-987654321',
            configId: 'main',
            setupAt: new Date().toISOString(),
            setupBy: {
                first_name: 'Admin',
                id: 654321,
                is_bot: false,
            },
        });

        telegramServer.setResponse('getChatMember', () => ({
            status: 'administrator',
            user: { first_name: 'Admin', id: 654321, is_bot: false },
        }));

        const setupCommand = telegramServer.createUserMessage({
            chatId: -987654321, // Same group ID
            firstName: 'Admin',
            isGroupChat: true,
            text: `/setup ${hashToken(config.BOT_TOKEN)}`,
            userId: 654321,
        });

        telegramServer.clearRequests();

        await bot.handleUpdate(setupCommand);

        const requests = telegramServer.getRequests();

        const warningMessage = requests.find(
            (req) => req.method === 'sendMessage' && req.params.text.includes('Setup was already completed'),
        );
        expect(warningMessage).toBeDefined();

        // Should not try to create topics or perform other setup actions
        expect(requests.some((req) => req.method === 'createForumTopic')).toBe(false);
    });
});

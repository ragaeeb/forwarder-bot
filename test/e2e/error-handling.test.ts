import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Bot } from '../../src/bot';
import { config } from '../../src/config';
import { registerHandlers } from '../../src/handlers';
import { MockDataService } from '../../src/services/mockDataService';
import { TelegramTestServer } from './telegramServer';

describe('Error Handling E2E Tests', () => {
    let telegramServer: TelegramTestServer;
    let uninstall: () => void;
    let bot: Bot;
    let db: MockDataService;
    let adminGroupId: string;

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

        // Setup the bot with admin group
        adminGroupId = '-100987654321';
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
    });

    afterEach(() => {
        uninstall();
        vi.clearAllTimers();
    });

    it('should handle message forward failures gracefully', async () => {
        // Create a user message
        const userMessage = telegramServer.createUserMessage({
            firstName: 'Test',
            text: 'Hello, I need help',
            userId: 123456,
            username: 'testuser',
        });

        // Mock forwardMessage to fail
        telegramServer.setResponse('forwardMessage', () => {
            throw new Error('Forward failed');
        });

        telegramServer.clearRequests();

        await bot.handleUpdate(userMessage);

        const requests = telegramServer.getRequests();

        // Should send failure message
        const errorMessage = requests.find(
            (req) => req.method === 'sendMessage' && req.params.chat_id === 123456 && req.params.text.includes('❌'),
        );
        expect(errorMessage).toBeDefined();
    });

    it('should handle thread creation failures gracefully', async () => {
        // Create a user message
        const userMessage = telegramServer.createUserMessage({
            firstName: 'Test',
            text: 'Hello, I need help',
            userId: 123456,
            username: 'testuser',
        });

        // Mock createForumTopic to fail
        telegramServer.setResponse('createForumTopic', () => {
            throw new Error('Create forum topic failed');
        });

        telegramServer.clearRequests();

        await bot.handleUpdate(userMessage);

        const requests = telegramServer.getRequests();

        // Should send failure message
        const errorMessage = requests.find(
            (req) => req.method === 'sendMessage' && req.params.chat_id === 123456 && req.params.text.includes('❌'),
        );
        expect(errorMessage).toBeDefined();
    });

    it('should handle admin reply failures gracefully', async () => {
        // Create a thread for the test user
        await db.saveThread({
            chatId: '123456',
            createdAt: new Date().toISOString(),
            lastMessageId: '456',
            name: 'Test User',
            threadId: '789',
            updatedAt: new Date().toISOString(),
            userId: '123456',
        });

        // Create an admin reply
        const adminReply = telegramServer.createUserMessage({
            chatId: Number(adminGroupId),
            firstName: 'Admin',
            isGroupChat: true,
            text: 'This is a reply to the user',
            userId: 654321,
        });

        adminReply.message!.message_thread_id = 789;
        adminReply.message!.reply_to_message = {
            chat: { id: Number(adminGroupId), type: 'supergroup' },
            date: Math.floor(Date.now() / 1000),
            from: { first_name: 'User', id: 123456, is_bot: false },
            message_id: 456,
            text: 'Original message',
        };

        // Mock sendMessage to fail
        telegramServer.setResponse('sendMessage', (params) => {
            if (params.chat_id === 123456) {
                throw new Error('Send failed');
            }

            // Only fail messages to the user, not error responses
            return {
                chat: {
                    id: params.chat_id,
                    type: params.chat_id < 0 ? 'supergroup' : 'private',
                },
                date: Math.floor(Date.now() / 1000),
                from: telegramServer['botInfo'],
                message_id: Math.floor(Math.random() * 10000),
                text: params.text,
            };
        });

        telegramServer.clearRequests();

        await bot.handleUpdate(adminReply);

        const requests = telegramServer.getRequests();

        // Should send error message to admin
        const errorMessage = requests.find(
            (req) =>
                req.method === 'sendMessage' &&
                req.params.chat_id === Number(adminGroupId) &&
                req.params.text.includes('❌'),
        );
        expect(errorMessage).toBeDefined();
    });

    it('should handle database errors during thread lookup', async () => {
        // Create an admin reply
        const adminReply = telegramServer.createUserMessage({
            chatId: Number(adminGroupId),
            firstName: 'Admin',
            isGroupChat: true,
            text: 'This is a reply to the user',
            userId: 654321,
        });

        adminReply.message!.message_thread_id = 789;
        adminReply.message!.reply_to_message = {
            chat: { id: Number(adminGroupId), type: 'supergroup' },
            date: Math.floor(Date.now() / 1000),
            from: { first_name: 'User', id: 123456, is_bot: false },
            message_id: 456,
            text: 'Original message',
        };

        // Mock db.getThreadById to fail
        const originalGetThreadById = db.getThreadById;
        db.getThreadById = vi.fn().mockRejectedValue(new Error('Database error'));

        telegramServer.clearRequests();

        await bot.handleUpdate(adminReply);

        const requests = telegramServer.getRequests();

        // Should send error message to admin
        const errorMessage = requests.find(
            (req) =>
                req.method === 'sendMessage' &&
                req.params.chat_id === Number(adminGroupId) &&
                req.params.text.includes('❌'),
        );
        expect(errorMessage).toBeDefined();

        // Restore original function
        db.getThreadById = originalGetThreadById;
    });

    it('should handle database errors during message saving', async () => {
        // Create a thread for the test user
        await db.saveThread({
            chatId: '123456',
            createdAt: new Date().toISOString(),
            lastMessageId: '456',
            name: 'Test User',
            threadId: '789',
            updatedAt: new Date().toISOString(),
            userId: '123456',
        });

        // Create a user message
        const userMessage = telegramServer.createUserMessage({
            firstName: 'Test',
            text: 'Hello, I need help',
            userId: 123456,
            username: 'testuser',
        });

        // Mock db.saveMessage to fail
        const originalSaveMessage = db.saveMessage;
        db.saveMessage = vi.fn().mockRejectedValue(new Error('Database error'));

        telegramServer.clearRequests();

        await bot.handleUpdate(userMessage);

        const requests = telegramServer.getRequests();

        // Should send failure message
        const errorMessage = requests.find(
            (req) => req.method === 'sendMessage' && req.params.chat_id === 123456 && req.params.text.includes('❌'),
        );
        expect(errorMessage).toBeDefined();

        // Restore original function
        db.saveMessage = originalSaveMessage;
    });

    it('should handle edited message errors gracefully', async () => {
        // Create a thread for the test user
        await db.saveThread({
            chatId: '123456',
            createdAt: new Date().toISOString(),
            lastMessageId: '456',
            name: 'Test User',
            threadId: '789',
            updatedAt: new Date().toISOString(),
            userId: '123456',
        });

        // Create an edited message
        const editedMessage = telegramServer.createUserMessage({
            firstName: 'Test',
            text: 'Edited message content',
            userId: 123456,
            username: 'testuser',
        });

        // Convert to edited_message
        const update = {
            edited_message: editedMessage.message,
            update_id: editedMessage.update_id,
        };
        update.edited_message!.message_id = 456; // Same as lastMessageId

        // Mock sendMessage to fail
        telegramServer.setResponse('sendMessage', () => {
            throw new Error('Send failed');
        });

        telegramServer.clearRequests();

        // Should not throw despite errors
        await expect(bot.handleUpdate(update)).resolves.not.toThrow();
    });

    it('should handle unsupported message types in admin replies', async () => {
        // Create a thread for the test user
        await db.saveThread({
            chatId: '123456',
            createdAt: new Date().toISOString(),
            lastMessageId: '456',
            name: 'Test User',
            threadId: '789',
            updatedAt: new Date().toISOString(),
            userId: '123456',
        });

        // Create an admin reply with unsupported content
        const adminReply = telegramServer.createUserMessage({
            chatId: Number(adminGroupId),
            firstName: 'Admin',
            isGroupChat: true,
            userId: 654321,
        });

        // Add location to the message (unsupported type)
        (adminReply.message as any).location = {
            latitude: 51.5074,
            longitude: 0.1278,
        };
        delete adminReply.message!.text;

        adminReply.message!.message_thread_id = 789;
        adminReply.message!.reply_to_message = {
            chat: { id: Number(adminGroupId), type: 'supergroup' },
            date: Math.floor(Date.now() / 1000),
            from: { first_name: 'User', id: 123456, is_bot: false },
            message_id: 456,
            text: 'Original message',
        };

        telegramServer.clearRequests();

        await bot.handleUpdate(adminReply);

        const requests = telegramServer.getRequests();

        // Should send error message about unsupported type
        const errorMessage = requests.find(
            (req) =>
                req.method === 'sendMessage' &&
                req.params.chat_id === Number(adminGroupId) &&
                req.params.text.includes('❌') &&
                req.params.text.includes('Unsupported message type'),
        );
        expect(errorMessage).toBeDefined();
    });
});

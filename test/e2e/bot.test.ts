import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Bot } from '../../src/bot';
import { config } from '../../src/config';
import { registerHandlers } from '../../src/handlers';
import { MockDataService } from '../../src/services/mockDataService';
import { TelegramTestServer } from './telegramServer';

describe('Telegram Bot E2E Tests', () => {
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

    it('should handle a direct message from a user', async () => {
        const userMessage = telegramServer.createUserMessage({
            firstName: 'Test',
            text: 'Hello bot!',
            userId: 123456,
            username: 'testuser',
        });

        await setupBotWithAdmin();
        telegramServer.clearRequests();

        await bot.handleUpdate(userMessage);

        const requests = telegramServer.getRequests();

        expect(requests.some((req) => req.method === 'createForumTopic')).toBe(true);
        expect(requests.some((req) => req.method === 'forwardMessage')).toBe(true);

        const sendMessageRequest = requests.find(
            (req) => req.method === 'sendMessage' && req.params.chat_id === 123456,
        );
        expect(sendMessageRequest).toBeDefined();
    });

    it('should handle admin reply to user', async () => {
        const adminGroupId = await setupBotWithAdmin();

        await db.saveThread({
            chatId: '123456',
            createdAt: new Date().toISOString(),
            lastMessageId: '456',
            name: 'Test User',
            threadId: '789',
            updatedAt: new Date().toISOString(),
            userId: '123456',
        });

        telegramServer.clearRequests();

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

        await bot.handleUpdate(adminReply);

        const requests = telegramServer.getRequests();

        const sendMessageRequest = requests.find(
            (req) => req.method === 'sendMessage' && req.params.chat_id === 123456,
        );
        expect(sendMessageRequest).toBeDefined();
        expect(sendMessageRequest?.params.text).toBe('This is a reply to the user');

        const confirmRequest = requests.find(
            (req) =>
                req.method === 'sendMessage' &&
                req.params.chat_id === Number(adminGroupId) &&
                req.params.text.includes('Reply sent to user'),
        );
        expect(confirmRequest).toBeDefined();
    });

    it('should handle /start command', async () => {
        await setupBotWithAdmin();
        telegramServer.clearRequests();

        const startCommand = telegramServer.createUserMessage({
            firstName: 'Test',
            text: '/start',
            userId: 123456,
            username: 'testuser',
        });

        await bot.handleUpdate(startCommand);

        const requests = telegramServer.getRequests();

        const sendMessageRequest = requests.find(
            (req) => req.method === 'sendMessage' && req.params.chat_id === 123456,
        );
        expect(sendMessageRequest).toBeDefined();
        expect(sendMessageRequest?.params.text).toContain('communicate with our team');
    });

    it('should handle custom greeting message', async () => {
        const adminGroupId = await setupBotWithAdmin();

        await db.saveSettings({
            adminGroupId,
            configId: 'main',
            greeting: 'Custom welcome message',
            setupAt: new Date().toISOString(),
            setupBy: {
                first_name: 'Admin',
                id: 654321,
                is_bot: false,
            },
        });

        telegramServer.clearRequests();

        const startCommand = telegramServer.createUserMessage({
            firstName: 'Test',
            text: '/start',
            userId: 123456,
            username: 'testuser',
        });

        await bot.handleUpdate(startCommand);

        const requests = telegramServer.getRequests();

        const sendMessageRequest = requests.find(
            (req) => req.method === 'sendMessage' && req.params.chat_id === 123456,
        );
        expect(sendMessageRequest).toBeDefined();
        expect(sendMessageRequest?.params.text).toBe('Custom welcome message');
    });

    it('should handle photo messages from users', async () => {
        await setupBotWithAdmin();
        telegramServer.clearRequests();

        const photoMessage = telegramServer.createUserMessage({
            firstName: 'Test',
            userId: 123456,
            username: 'testuser',
        });

        // Add photo to the message
        photoMessage.message!.photo = [
            { file_id: 'small_id', file_unique_id: 'small', height: 100, width: 100 },
            { file_id: 'large_id', file_unique_id: 'large', height: 800, width: 800 },
        ];
        photoMessage.message!.caption = 'Check out this photo';

        await bot.handleUpdate(photoMessage);

        const requests = telegramServer.getRequests();
        expect(requests.some((req) => req.method === 'forwardMessage')).toBe(true);
    });

    it('should handle document messages from users', async () => {
        await setupBotWithAdmin();
        telegramServer.clearRequests();

        const documentMessage = telegramServer.createUserMessage({
            firstName: 'Test',
            userId: 123456,
            username: 'testuser',
        });

        // Add document to the message
        documentMessage.message!.document = {
            file_id: 'doc_id',
            file_name: 'test.pdf',
            file_unique_id: 'unique_doc_id',
        };
        documentMessage.message!.caption = 'Check out this document';
        documentMessage.message!.text = undefined;

        await bot.handleUpdate(documentMessage);

        const requests = telegramServer.getRequests();
        expect(requests.some((req) => req.method === 'forwardMessage')).toBe(true);
    });

    it('should handle custom acknowledgment message', async () => {
        const adminGroupId = await setupBotWithAdmin();

        await db.saveSettings({
            ack: 'Custom acknowledgment message',
            adminGroupId,
            configId: 'main',
            setupAt: new Date().toISOString(),
            setupBy: {
                first_name: 'Admin',
                id: 654321,
                is_bot: false,
            },
        });

        telegramServer.clearRequests();

        const message = telegramServer.createUserMessage({
            firstName: 'Test',
            text: 'Hello there',
            userId: 123456,
            username: 'testuser',
        });

        await bot.handleUpdate(message);

        const requests = telegramServer.getRequests();

        const sendMessageRequest = requests.find(
            (req) =>
                req.method === 'sendMessage' &&
                req.params.chat_id === 123456 &&
                req.params.text.includes('Custom acknowledgment message'),
        );
        expect(sendMessageRequest).toBeDefined();
    });

    it('should handle edited messages from users', async () => {
        await setupBotWithAdmin();

        await db.saveThread({
            chatId: '123456',
            createdAt: new Date().toISOString(),
            lastMessageId: '456',
            name: 'Test User',
            threadId: '789',
            updatedAt: new Date().toISOString(),
            userId: '123456',
        });

        telegramServer.clearRequests();

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

        await bot.handleUpdate(update);

        const requests = telegramServer.getRequests();

        // Should send notification about edit
        const notificationRequest = requests.find(
            (req) => req.method === 'sendMessage' && req.params.text.includes('Message Edit Notification'),
        );
        expect(notificationRequest).toBeDefined();

        // Should forward the edited message
        expect(requests.some((req) => req.method === 'forwardMessage')).toBe(true);
    });

    it('should handle admin reply with photo', async () => {
        const adminGroupId = await setupBotWithAdmin();

        await db.saveThread({
            chatId: '123456',
            createdAt: new Date().toISOString(),
            lastMessageId: '456',
            name: 'Test User',
            threadId: '789',
            updatedAt: new Date().toISOString(),
            userId: '123456',
        });

        telegramServer.clearRequests();

        const adminReply = telegramServer.createUserMessage({
            chatId: Number(adminGroupId),
            firstName: 'Admin',
            isGroupChat: true,
            userId: 654321,
        });

        // Add photo to the message
        adminReply.message!.photo = [
            { file_id: 'small_photo', file_unique_id: 'small', height: 100, width: 100 },
            { file_id: 'large_photo', file_unique_id: 'large', height: 800, width: 800 },
        ];
        adminReply.message!.caption = 'Photo reply';
        adminReply.message!.text = undefined;

        adminReply.message!.message_thread_id = 789;
        adminReply.message!.reply_to_message = {
            chat: { id: Number(adminGroupId), type: 'supergroup' },
            date: Math.floor(Date.now() / 1000),
            from: { first_name: 'User', id: 123456, is_bot: false },
            message_id: 456,
            text: 'Original message',
        };

        // Setup response for sendPhoto
        telegramServer.setResponse('sendPhoto', (params) => ({
            caption: params.caption,
            chat: {
                id: params.chat_id,
                type: params.chat_id < 0 ? 'supergroup' : 'private',
            },
            date: Math.floor(Date.now() / 1000),
            from: telegramServer['botInfo'],
            message_id: Math.floor(Math.random() * 10000),
            photo: [{ file_id: params.photo, file_unique_id: 'unique', height: 800, width: 800 }],
        }));

        await bot.handleUpdate(adminReply);

        const requests = telegramServer.getRequests();

        const sendPhotoRequest = requests.find((req) => req.method === 'sendPhoto' && req.params.chat_id === 123456);
        expect(sendPhotoRequest).toBeDefined();
        expect(sendPhotoRequest?.params.photo).toBe('large_photo');
        expect(sendPhotoRequest?.params.caption).toBe('Photo reply');
    });

    it('should handle admin reply with document', async () => {
        const adminGroupId = await setupBotWithAdmin();

        await db.saveThread({
            chatId: '123456',
            createdAt: new Date().toISOString(),
            lastMessageId: '456',
            name: 'Test User',
            threadId: '789',
            updatedAt: new Date().toISOString(),
            userId: '123456',
        });

        telegramServer.clearRequests();

        const adminReply = telegramServer.createUserMessage({
            chatId: Number(adminGroupId),
            firstName: 'Admin',
            isGroupChat: true,
            userId: 654321,
        });

        // Add document to the message
        adminReply.message!.document = {
            file_id: 'doc_id',
            file_name: 'test.pdf',
            file_unique_id: 'unique_doc_id',
        };
        adminReply.message!.caption = 'Document reply';
        adminReply.message!.text = undefined;

        adminReply.message!.message_thread_id = 789;
        adminReply.message!.reply_to_message = {
            chat: { id: Number(adminGroupId), type: 'supergroup' },
            date: Math.floor(Date.now() / 1000),
            from: { first_name: 'User', id: 123456, is_bot: false },
            message_id: 456,
            text: 'Original message',
        };

        // Setup response for sendDocument
        telegramServer.setResponse('sendDocument', (params) => ({
            caption: params.caption,
            chat: {
                id: params.chat_id,
                type: params.chat_id < 0 ? 'supergroup' : 'private',
            },
            date: Math.floor(Date.now() / 1000),
            document: {
                file_id: params.document,
                file_name: 'test.pdf',
                file_unique_id: 'unique_doc_id',
            },
            from: telegramServer['botInfo'],
            message_id: Math.floor(Math.random() * 10000),
        }));

        await bot.handleUpdate(adminReply);

        const requests = telegramServer.getRequests();

        const sendDocumentRequest = requests.find(
            (req) => req.method === 'sendDocument' && req.params.chat_id === 123456,
        );
        expect(sendDocumentRequest).toBeDefined();
        expect(sendDocumentRequest?.params.document).toBe('doc_id');
        expect(sendDocumentRequest?.params.caption).toBe('Document reply');
    });

    it('should reject direct message if setup is not completed', async () => {
        telegramServer.clearRequests();

        const message = telegramServer.createUserMessage({
            firstName: 'Test',
            text: 'Hello there',
            userId: 123456,
            username: 'testuser',
        });

        await bot.handleUpdate(message);

        const requests = telegramServer.getRequests();

        // Should not process the message without setup
        expect(requests.length).toBe(0);
    });

    async function setupBotWithAdmin() {
        const adminGroupId = '-100987654321';

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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Bot } from '../../src/bot';
import { config } from '../../src/config';
import { registerHandlers } from '../../src/handlers';
import { MockDataService } from '../../src/services/mockDataService';
import { TelegramTestServer } from './telegramServer';

describe('Message Types E2E Tests', () => {
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

        // Setup thread for test user
        await db.saveThread({
            chatId: '123456',
            createdAt: new Date().toISOString(),
            lastMessageId: '456',
            name: 'Test User',
            threadId: '789',
            updatedAt: new Date().toISOString(),
            userId: '123456',
        });
    });

    afterEach(() => {
        uninstall();
        vi.clearAllTimers();
    });

    it('should handle voice messages from user to admin', async () => {
        // Create a user voice message
        const voiceMessage = telegramServer.createUserMessage({
            firstName: 'Test',
            userId: 123456,
            username: 'testuser',
        });

        // Add voice to the message
        voiceMessage.message!.voice = {
            duration: 10,
            file_id: 'voice_file_id',
            file_unique_id: 'unique_voice_id',
        };
        delete voiceMessage.message!.text;

        // Setup response for forwardMessage
        telegramServer.setResponse('forwardMessage', (params) => ({
            chat: {
                id: params.chat_id,
                type: params.chat_id < 0 ? 'supergroup' : 'private',
            },
            date: Math.floor(Date.now() / 1000),
            from: telegramServer['botInfo'],
            message_id: Math.floor(Math.random() * 10000),
            voice: {
                duration: 10,
                file_id: 'voice_file_id',
                file_unique_id: 'unique_voice_id',
            },
        }));

        telegramServer.clearRequests();

        await bot.handleUpdate(voiceMessage);

        const requests = telegramServer.getRequests();

        // Should forward the voice message
        const forwardRequest = requests.find(
            (req) => req.method === 'forwardMessage' && req.params.from_chat_id === 123456,
        );
        expect(forwardRequest).toBeDefined();

        // Should send acknowledgment
        const ackMessage = requests.find((req) => req.method === 'sendMessage' && req.params.chat_id === 123456);
        expect(ackMessage).toBeDefined();
    });

    it('should handle voice message replies from admin to user', async () => {
        // Create an admin voice reply
        const adminReply = telegramServer.createUserMessage({
            chatId: Number(adminGroupId),
            firstName: 'Admin',
            isGroupChat: true,
            userId: 654321,
        });

        // Add voice to the message
        adminReply.message!.voice = {
            duration: 15,
            file_id: 'admin_voice_id',
            file_unique_id: 'unique_admin_voice_id',
        };
        delete adminReply.message!.text;

        // Setup as a reply in thread
        adminReply.message!.message_thread_id = 789;
        adminReply.message!.reply_to_message = {
            chat: { id: Number(adminGroupId), type: 'supergroup' },
            date: Math.floor(Date.now() / 1000),
            from: { first_name: 'User', id: 123456, is_bot: false },
            message_id: 456,
            text: 'Original message',
        };

        // Setup response for sendVoice
        telegramServer.setResponse('sendVoice', (params) => ({
            chat: {
                id: params.chat_id,
                type: params.chat_id < 0 ? 'supergroup' : 'private',
            },
            date: Math.floor(Date.now() / 1000),
            from: telegramServer['botInfo'],
            message_id: Math.floor(Math.random() * 10000),
            voice: {
                duration: 15,
                file_id: params.voice,
                file_unique_id: 'unique_admin_voice_id',
            },
        }));

        telegramServer.clearRequests();

        await bot.handleUpdate(adminReply);

        const requests = telegramServer.getRequests();

        // Should send voice to user
        const sendVoiceRequest = requests.find((req) => req.method === 'sendVoice' && req.params.chat_id === 123456);
        expect(sendVoiceRequest).toBeDefined();
        expect(sendVoiceRequest?.params.voice).toBe('admin_voice_id');

        // Should send confirmation to admin
        const confirmMessage = requests.find(
            (req) =>
                req.method === 'sendMessage' &&
                req.params.chat_id === Number(adminGroupId) &&
                req.params.text.includes('Reply sent to user'),
        );
        expect(confirmMessage).toBeDefined();
    });

    it('should handle video messages from user to admin', async () => {
        // Create a user video message
        const videoMessage = telegramServer.createUserMessage({
            firstName: 'Test',
            userId: 123456,
            username: 'testuser',
        });

        // Add video to the message
        videoMessage.message!.video = {
            duration: 30,
            file_id: 'video_file_id',
            file_unique_id: 'unique_video_id',
            height: 720,
            width: 1280,
        };
        videoMessage.message!.caption = 'Check out this video';
        delete videoMessage.message!.text;

        telegramServer.clearRequests();

        await bot.handleUpdate(videoMessage);

        const requests = telegramServer.getRequests();

        // Should forward the video message
        const forwardRequest = requests.find(
            (req) => req.method === 'forwardMessage' && req.params.from_chat_id === 123456,
        );
        expect(forwardRequest).toBeDefined();
    });

    it('should handle video message replies from admin to user', async () => {
        // Create an admin video reply
        const adminReply = telegramServer.createUserMessage({
            chatId: Number(adminGroupId),
            firstName: 'Admin',
            isGroupChat: true,
            userId: 654321,
        });

        // Add video to the message
        adminReply.message!.video = {
            duration: 30,
            file_id: 'admin_video_id',
            file_unique_id: 'unique_admin_video_id',
            height: 720,
            width: 1280,
        };
        adminReply.message!.caption = 'Video response';
        delete adminReply.message!.text;

        // Setup as a reply in thread
        adminReply.message!.message_thread_id = 789;
        adminReply.message!.reply_to_message = {
            chat: { id: Number(adminGroupId), type: 'supergroup' },
            date: Math.floor(Date.now() / 1000),
            from: { first_name: 'User', id: 123456, is_bot: false },
            message_id: 456,
            text: 'Original message',
        };

        // Setup response for sendVideo
        telegramServer.setResponse('sendVideo', (params) => ({
            caption: params.caption,
            chat: {
                id: params.chat_id,
                type: params.chat_id < 0 ? 'supergroup' : 'private',
            },
            date: Math.floor(Date.now() / 1000),
            from: telegramServer['botInfo'],
            message_id: Math.floor(Math.random() * 10000),
            video: {
                duration: 30,
                file_id: params.video,
                file_unique_id: 'unique_admin_video_id',
                height: 720,
                width: 1280,
            },
        }));

        telegramServer.clearRequests();

        await bot.handleUpdate(adminReply);

        const requests = telegramServer.getRequests();

        // Should send video to user
        const sendVideoRequest = requests.find((req) => req.method === 'sendVideo' && req.params.chat_id === 123456);
        expect(sendVideoRequest).toBeDefined();
        expect(sendVideoRequest?.params.video).toBe('admin_video_id');
        expect(sendVideoRequest?.params.caption).toBe('Video response');
    });

    it('should handle forwarded messages', async () => {
        // Create a forwarded message
        const forwardedMessage = telegramServer.createUserMessage({
            firstName: 'Test',
            text: 'Forwarded content',
            userId: 123456,
            username: 'testuser',
        });

        // Add forward information
        forwardedMessage.message!.forward_origin = {
            date: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
            sender_user: {
                first_name: 'Original',
                id: 789012,
                is_bot: false,
            },
            type: 'user',
        };

        telegramServer.clearRequests();

        await bot.handleUpdate(forwardedMessage);

        const requests = telegramServer.getRequests();

        // Should forward the message to admin group
        const forwardRequest = requests.find(
            (req) => req.method === 'forwardMessage' && req.params.from_chat_id === 123456,
        );
        expect(forwardRequest).toBeDefined();

        // Should store the message with forward origin
        const savedMessages = await db.getMessagesByUserId('123456');
        const lastMessage = savedMessages[savedMessages.length - 1];
        expect(lastMessage.forwardOrigin).toBeDefined();
        expect(lastMessage.forwardOrigin?.type).toBe('user');
    });

    it('should handle messages with stickers', async () => {
        // Create a message with sticker
        const stickerMessage = telegramServer.createUserMessage({
            firstName: 'Test',
            userId: 123456,
            username: 'testuser',
        });

        // Add sticker to the message
        stickerMessage.message!.sticker = {
            emoji: '😊',
            file_id: 'sticker_file_id',
            file_unique_id: 'unique_sticker_id',
            height: 512,
            is_animated: false,
            is_video: false,
            type: 'regular',
            width: 512,
        };
        delete stickerMessage.message!.text;

        telegramServer.clearRequests();

        await bot.handleUpdate(stickerMessage);

        const requests = telegramServer.getRequests();

        // Should forward the sticker message
        const forwardRequest = requests.find(
            (req) => req.method === 'forwardMessage' && req.params.from_chat_id === 123456,
        );
        expect(forwardRequest).toBeDefined();

        // Should store the message with sticker information
        const savedMessages = await db.getMessagesByUserId('123456');
        const lastMessage = savedMessages[savedMessages.length - 1];
        expect(lastMessage.mediaType).toBe('sticker');
        expect(lastMessage.mediaId).toBe('sticker_file_id');
    });

    it('should handle messages with quoted replies', async () => {
        // Create a message with quote
        const quotedMessage = telegramServer.createUserMessage({
            firstName: 'Test',
            text: 'This is my reply to what you said',
            userId: 123456,
            username: 'testuser',
        });

        // Add quote to the message
        quotedMessage.message!.quote = {
            entities: [],
            position: 0,
            text: 'This is the quoted text',
        };

        telegramServer.clearRequests();

        await bot.handleUpdate(quotedMessage);

        const requests = telegramServer.getRequests();

        // Should forward the quoted message
        const forwardRequest = requests.find(
            (req) => req.method === 'forwardMessage' && req.params.from_chat_id === 123456,
        );
        expect(forwardRequest).toBeDefined();

        // Should store the message with quote information
        const savedMessages = await db.getMessagesByUserId('123456');
        const lastMessage = savedMessages[savedMessages.length - 1];
        expect(lastMessage.quote).toBe('This is the quoted text');
    });

    it('should handle reply_to_message references', async () => {
        // Create a message that is a reply to another message
        const replyMessage = telegramServer.createUserMessage({
            firstName: 'Test',
            text: 'This is my reply to your previous message',
            userId: 123456,
            username: 'testuser',
        });

        // Add reply_to_message
        replyMessage.message!.reply_to_message = {
            chat: { id: 123456, type: 'private' },
            date: Math.floor(Date.now() / 1000) - 60,
            from: telegramServer['botInfo'],
            message_id: 112233,
            text: 'Previous message from bot',
        };

        telegramServer.clearRequests();

        await bot.handleUpdate(replyMessage);

        // Should store the message with replyToMessageId
        const savedMessages = await db.getMessagesByUserId('123456');
        const lastMessage = savedMessages[savedMessages.length - 1];
        expect(lastMessage.replyToMessageId).toBe('112233');
    });
});

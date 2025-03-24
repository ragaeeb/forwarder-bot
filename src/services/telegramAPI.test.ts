import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TelegramAPI } from './telegramAPI.js';

describe('telegramAPI', () => {
    let api: TelegramAPI;
    let fetchMock: any;

    beforeEach(() => {
        api = new TelegramAPI('test-token');

        fetchMock = vi.fn().mockImplementation(async () => {
            return {
                json: async () => ({ ok: true, result: { mock: 'data' } }),
                ok: true,
            };
        });

        global.fetch = fetchMock;
    });

    it('should initialize with a token', () => {
        expect(api).toBeDefined();
    });

    it('should make API calls with correct URL and headers', async () => {
        await api.getMe();

        expect(fetchMock).toHaveBeenCalledWith('https://api.telegram.org/bottest-token/getMe', {
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'POST',
        });
    });

    it('should handle unsuccessful responses', async () => {
        fetchMock.mockImplementationOnce(async () => ({
            ok: false,
            status: 404,
            text: async () => 'Error message',
        }));

        await expect(api.getMe()).rejects.toThrow('Telegram API error (404): Error message');
    });

    it('should handle unsuccessful API results', async () => {
        fetchMock.mockImplementationOnce(async () => ({
            json: async () => ({
                description: 'API error',
                error_code: 400,
                ok: false,
            }),
            ok: true,
        }));

        await expect(api.getMe()).rejects.toThrow('Telegram API error: API error (400)');
    });

    it('should handle errors with incomplete error data', async () => {
        fetchMock.mockImplementationOnce(async () => ({
            json: async () => ({
                ok: false,
            }),
            ok: true,
        }));

        await expect(api.getMe()).rejects.toThrow('Telegram API error: Unknown error (No code)');
    });

    it('should cache getMe results', async () => {
        const result = { first_name: 'TestBot', id: 123, is_bot: true };
        fetchMock.mockImplementationOnce(async () => ({
            json: async () => ({ ok: true, result }),
            ok: true,
        }));

        const meFirst = await api.getMe();
        expect(meFirst).toEqual(result);

        const meSecond = await api.getMe();
        expect(meSecond).toEqual(result);

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should create forum topic', async () => {
        const params = {
            chat_id: 123,
            icon_color: 9367192,
            icon_custom_emoji_id: '12345',
            name: 'Test Topic',
        };

        await api.createForumTopic(params);

        expect(fetchMock).toHaveBeenCalledWith('https://api.telegram.org/bottest-token/createForumTopic', {
            body: JSON.stringify(params),
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'POST',
        });
    });

    it('should delete forum topic', async () => {
        const params = {
            chat_id: 123,
            message_thread_id: 456,
        };

        await api.deleteForumTopic(params);

        expect(fetchMock).toHaveBeenCalledWith('https://api.telegram.org/bottest-token/deleteForumTopic', {
            body: JSON.stringify(params),
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'POST',
        });
    });

    it('should delete webhook with params', async () => {
        const params = {
            drop_pending_updates: true,
        };

        await api.deleteWebhook(params);

        expect(fetchMock).toHaveBeenCalledWith('https://api.telegram.org/bottest-token/deleteWebhook', {
            body: JSON.stringify(params),
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'POST',
        });
    });

    it('should delete webhook without params', async () => {
        await api.deleteWebhook();

        expect(fetchMock).toHaveBeenCalledWith('https://api.telegram.org/bottest-token/deleteWebhook', {
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'POST',
        });
    });

    it('should forward message', async () => {
        const params = {
            chat_id: 123,
            from_chat_id: 456,
            message_id: 789,
            message_thread_id: 101112,
        };

        await api.forwardMessage(params);

        expect(fetchMock).toHaveBeenCalledWith('https://api.telegram.org/bottest-token/forwardMessage', {
            body: JSON.stringify(params),
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'POST',
        });
    });

    it('should get chat member', async () => {
        const params = {
            chat_id: 123,
            user_id: 456,
        };

        await api.getChatMember(params);

        expect(fetchMock).toHaveBeenCalledWith('https://api.telegram.org/bottest-token/getChatMember', {
            body: JSON.stringify(params),
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'POST',
        });
    });

    it('should get updates with params', async () => {
        const params = {
            allowed_updates: ['message', 'callback_query'],
            limit: 10,
            offset: 100,
            timeout: 30,
        };

        await api.getUpdates(params);

        expect(fetchMock).toHaveBeenCalledWith('https://api.telegram.org/bottest-token/getUpdates', {
            body: JSON.stringify(params),
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'POST',
        });
    });

    it('should get updates without params', async () => {
        await api.getUpdates();

        expect(fetchMock).toHaveBeenCalledWith('https://api.telegram.org/bottest-token/getUpdates', {
            body: JSON.stringify({}),
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'POST',
        });
    });

    it('should leave chat', async () => {
        const params = {
            chat_id: 123,
        };

        await api.leaveChat(params);

        expect(fetchMock).toHaveBeenCalledWith('https://api.telegram.org/bottest-token/leaveChat', {
            body: JSON.stringify(params),
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'POST',
        });
    });

    it('should send document', async () => {
        const params = {
            caption: 'Test document',
            chat_id: 123,
            document: 'file_id',
            protect_content: true,
        };

        await api.sendDocument(params);

        expect(fetchMock).toHaveBeenCalledWith('https://api.telegram.org/bottest-token/sendDocument', {
            body: JSON.stringify(params),
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'POST',
        });
    });

    it('should send message', async () => {
        const params = {
            chat_id: 123,
            message_thread_id: 456,
            parse_mode: 'HTML' as const,
            protect_content: true,
            text: 'Test message',
        };

        await api.sendMessage(params);

        expect(fetchMock).toHaveBeenCalledWith('https://api.telegram.org/bottest-token/sendMessage', {
            body: JSON.stringify(params),
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'POST',
        });
    });

    it('should send photo', async () => {
        const params = {
            caption: 'Test photo',
            chat_id: 123,
            photo: 'file_id',
            protect_content: true,
        };

        await api.sendPhoto(params);

        expect(fetchMock).toHaveBeenCalledWith('https://api.telegram.org/bottest-token/sendPhoto', {
            body: JSON.stringify(params),
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'POST',
        });
    });

    it('should send video', async () => {
        const params = {
            caption: 'Test video',
            chat_id: 123,
            protect_content: true,
            video: 'file_id',
        };

        await api.sendVideo(params);

        expect(fetchMock).toHaveBeenCalledWith('https://api.telegram.org/bottest-token/sendVideo', {
            body: JSON.stringify(params),
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'POST',
        });
    });

    it('should send voice', async () => {
        const params = {
            caption: 'Test voice',
            chat_id: 123,
            protect_content: true,
            voice: 'file_id',
        };

        await api.sendVoice(params);

        expect(fetchMock).toHaveBeenCalledWith('https://api.telegram.org/bottest-token/sendVoice', {
            body: JSON.stringify(params),
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'POST',
        });
    });

    it('should set webhook', async () => {
        const params = {
            drop_pending_updates: true,
            secret_token: 'secret123',
            url: 'https://example.com/webhook',
        };

        await api.setWebhook(params);

        expect(fetchMock).toHaveBeenCalledWith('https://api.telegram.org/bottest-token/setWebhook', {
            body: JSON.stringify(params),
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'POST',
        });
    });
});

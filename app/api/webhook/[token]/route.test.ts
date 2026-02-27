import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { NextRequest } from 'next/server';

const mockHandleUpdate = mock(() => Promise.resolve());
const mockGetBot = mock(() => Promise.resolve({ handleUpdate: mockHandleUpdate }));
const mockResetBotInstance = mock(() => {});

mock.module('../../../../lib/bot/instance.js', () => ({
    getBot: mockGetBot,
    resetBotInstance: mockResetBotInstance,
}));

mock.module('../../../../src/config.js', () => ({
    config: {
        BOT_TOKEN: 'test-bot-token',
        SECRET_TOKEN: 'test-secret-token',
    },
}));

const { POST } = await import('./route.js');

describe('POST /api/webhook/[token]', () => {
    const validBody = JSON.stringify({
        message: {
            chat: { id: 123, type: 'private' },
            date: 1645564800,
            message_id: 456,
            text: 'Hello',
        },
        update_id: 123456,
    });

    const makeRequest = (options: { body?: string | null; secretToken?: string | null }) => {
        const headers: Record<string, string> = {};
        if (options.secretToken !== null) {
            headers['x-telegram-bot-api-secret-token'] = options.secretToken ?? 'test-secret-token';
        }
        return new NextRequest('http://localhost/api/webhook/test-bot-token', {
            body: options.body === null ? undefined : (options.body ?? validBody),
            headers,
            method: 'POST',
        });
    };

    beforeEach(() => {
        mock.restore();
        mockHandleUpdate.mockResolvedValue(undefined);
        mockGetBot.mockResolvedValue({ handleUpdate: mockHandleUpdate });
    });

    it('should return 403 when URL token does not match BOT_TOKEN', async () => {
        const req = new NextRequest('http://localhost/api/webhook/wrong-token', {
            body: validBody,
            headers: { 'x-telegram-bot-api-secret-token': 'test-secret-token' },
            method: 'POST',
        });
        const res = await POST(req, { params: Promise.resolve({ token: 'wrong-token' }) });
        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.ok).toBe(false);
        expect(mockHandleUpdate).not.toHaveBeenCalled();
    });

    it('should return 403 when secret header is invalid', async () => {
        const req = makeRequest({ secretToken: 'invalid-secret' });
        const res = await POST(req, { params: Promise.resolve({ token: 'test-bot-token' }) });
        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.ok).toBe(false);
        expect(mockHandleUpdate).not.toHaveBeenCalled();
    });

    it('should return 200 and call handleUpdate on valid request', async () => {
        const req = makeRequest({});
        const res = await POST(req, { params: Promise.resolve({ token: 'test-bot-token' }) });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.ok).toBe(true);
        expect(mockHandleUpdate).toHaveBeenCalledTimes(1);
    });

    it('should return 200 even when body is empty', async () => {
        const req = makeRequest({ body: '' });
        const res = await POST(req, { params: Promise.resolve({ token: 'test-bot-token' }) });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.ok).toBe(true);
        expect(mockHandleUpdate).not.toHaveBeenCalled();
    });

    it('should return 200 with error when handleUpdate throws', async () => {
        mockHandleUpdate.mockRejectedValue(new Error('Bot error'));
        mockGetBot.mockResolvedValue({ handleUpdate: mockHandleUpdate });
        const req = makeRequest({});
        const res = await POST(req, { params: Promise.resolve({ token: 'test-bot-token' }) });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.ok).toBe(false);
        expect(data.error).toBeDefined();
    });

    it('should return 200 with error when getBot throws', async () => {
        mockGetBot.mockRejectedValue(new Error('Bot init failed'));
        const req = makeRequest({});
        const res = await POST(req, { params: Promise.resolve({ token: 'test-bot-token' }) });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.ok).toBe(false);
        expect(data.error).toContain('Bot init failed');
    });
});

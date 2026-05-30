import { beforeEach, describe, expect, it, mock } from 'bun:test';

const mockHandleUpdate = mock(() => Promise.resolve(undefined));
const mockGetBot = mock(() => ({ handleUpdate: mockHandleUpdate }));

mock.module('../../../../lib/bot/instance.js', () => ({
    getBot: mockGetBot,
}));

mock.module('@/config.js', () => ({
    config: { SECRET_TOKEN: 'test-secret-token' },
}));

import { POST } from './route.js';

describe('webhook POST', () => {
    beforeEach(() => {
        mockHandleUpdate.mockClear();
        mockGetBot.mockClear();
    });

    it('valid secret token -> calls handleUpdate -> returns 200', async () => {
        const body = { update_id: 123, message: { text: 'hello' } };
        const req = new Request('http://localhost/api/webhook/token', {
            method: 'POST',
            headers: { 'x-telegram-bot-api-secret-token': 'test-secret-token' },
            body: JSON.stringify(body),
        });

        const response = await POST(req as any, { params: Promise.resolve({ token: 'token' }) });
        const data = await response.json();

        expect(mockGetBot).toHaveBeenCalled();
        expect(mockHandleUpdate).toHaveBeenCalledWith(body);
        expect(response.status).toBe(200);
        expect(data).toEqual({ ok: true });
    });

    it('invalid secret token -> returns 403', async () => {
        const req = new Request('http://localhost/api/webhook/token', {
            method: 'POST',
            headers: { 'x-telegram-bot-api-secret-token': 'wrong-token' },
            body: JSON.stringify({ update_id: 1 }),
        });

        const response = await POST(req as any, { params: Promise.resolve({ token: 'token' }) });
        const data = await response.json();

        expect(mockHandleUpdate).not.toHaveBeenCalled();
        expect(response.status).toBe(403);
        expect(data).toEqual({ error: 'Unauthorized', ok: false });
    });

    it('missing body -> returns 200', async () => {
        const req = new Request('http://localhost/api/webhook/token', {
            method: 'POST',
            headers: { 'x-telegram-bot-api-secret-token': 'test-secret-token' },
        });

        const response = await POST(req as any, { params: Promise.resolve({ token: 'token' }) });
        const data = await response.json();

        expect(mockHandleUpdate).not.toHaveBeenCalled();
        expect(response.status).toBe(200);
        expect(data).toEqual({ ok: true });
    });

    it('handleUpdate throws -> returns 200 with ok: false', async () => {
        mockHandleUpdate.mockImplementationOnce(() => Promise.reject(new Error('Bot error')));

        const req = new Request('http://localhost/api/webhook/token', {
            method: 'POST',
            headers: { 'x-telegram-bot-api-secret-token': 'test-secret-token' },
            body: JSON.stringify({ update_id: 1 }),
        });

        const response = await POST(req as any, { params: Promise.resolve({ token: 'token' }) });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual({ ok: false, error: 'Bot error' });
    });
});

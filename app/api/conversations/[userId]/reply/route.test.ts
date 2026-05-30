import { beforeEach, describe, expect, it, mock } from 'bun:test';

const mockThread = {
    threadId: '123',
    userId: '456',
    name: 'Test User',
    lastMessageId: '10',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
};

const mockSentMessage = {
    message_id: 99,
    chat: { id: 456, type: 'private' as const },
    date: Math.floor(Date.now() / 1000),
    text: 'Reply text',
    from: { id: 1, first_name: 'Bot', is_bot: true },
};

const mockDb = {
    getThreadByUserId: mock(() => Promise.resolve(mockThread)),
    saveMessage: mock(() => Promise.resolve({})),
    saveThread: mock(() => Promise.resolve(mockThread)),
};

const mockSendReply = mock(() => Promise.resolve(mockSentMessage));

mock.module('../../../../../lib/db/index.js', () => ({
    getDataService: mock(() => mockDb),
}));

mock.module('../../../../../lib/telegram/sendReply.js', () => ({
    sendReply: mockSendReply,
}));

import { POST } from './route.js';

describe('conversations [userId] reply POST', () => {
    beforeEach(() => {
        mockDb.getThreadByUserId.mockClear();
        mockDb.saveMessage.mockClear();
        mockDb.saveThread.mockClear();
        mockSendReply.mockClear();
    });

    it('sends message, saves to DB, returns ok with messageId', async () => {
        const req = new Request('http://localhost/api/conversations/456/reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: 'Hello from admin' }),
        });

        const response = await POST(req as any, { params: Promise.resolve({ userId: '456' }) });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.ok).toBe(true);
        expect(data.messageId).toBe('99');
        expect(mockSendReply).toHaveBeenCalledWith('456', 'Hello from admin');
        expect(mockDb.saveMessage).toHaveBeenCalled();
        expect(mockDb.saveThread).toHaveBeenCalledWith(
            expect.objectContaining({
                threadId: mockThread.threadId,
                userId: mockThread.userId,
                lastMessageId: '99',
            }),
        );
        expect(mockDb.saveThread.mock.calls[0][0].updatedAt).toBeDefined();
    });

    it('missing text -> 400', async () => {
        const req = new Request('http://localhost/api/conversations/456/reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });

        const response = await POST(req as any, { params: Promise.resolve({ userId: '456' }) });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.ok).toBe(false);
        expect(data.error).toContain('text');
        expect(mockSendReply).not.toHaveBeenCalled();
    });

    it('thread not found -> 404', async () => {
        mockDb.getThreadByUserId.mockResolvedValueOnce(undefined);

        const req = new Request('http://localhost/api/conversations/999/reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: 'Hello' }),
        });

        const response = await POST(req as any, { params: Promise.resolve({ userId: '999' }) });
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.ok).toBe(false);
        expect(data.error).toBe('Thread not found');
        expect(mockSendReply).not.toHaveBeenCalled();
    });

    it('Telegram failure -> returns 200 with error', async () => {
        mockSendReply.mockRejectedValueOnce(new Error('Telegram API error'));

        const req = new Request('http://localhost/api/conversations/456/reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: 'Hello' }),
        });

        const response = await POST(req as any, { params: Promise.resolve({ userId: '456' }) });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.ok).toBe(false);
        expect(data.error).toBe('Telegram API error');
        expect(mockDb.saveMessage).not.toHaveBeenCalled();
    });
});

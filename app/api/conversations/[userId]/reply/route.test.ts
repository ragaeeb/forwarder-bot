import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { NextRequest } from 'next/server';

const mockSendReplyToUser = mock(() => Promise.resolve('msg_sent_001'));
const mockSaveMessage = mock(() =>
    Promise.resolve({ id: 'msg_sent_001', text: 'Hi!', timestamp: '2023-01-01T00:00:00.000Z', type: 'admin' }),
);
const mockSaveThread = mock(() => Promise.resolve({}));
const mockGetThreadByUserId = mock(() =>
    Promise.resolve({
        createdAt: '2023-01-01T00:00:00.000Z',
        lastMessageId: 'msg_000',
        name: 'Test User',
        threadId: '11111',
        updatedAt: '2023-01-01T00:00:00.000Z',
        userId: '123456',
    }),
);

const mockGetDb = mock(() =>
    Promise.resolve({
        getThreadByUserId: mockGetThreadByUserId,
        saveMessage: mockSaveMessage,
        saveThread: mockSaveThread,
    }),
);

mock.module('../../../../../lib/db/index.js', () => ({ getDb: mockGetDb }));
mock.module('../../../../../lib/telegram/sendReply.js', () => ({
    sendReplyToUser: mockSendReplyToUser,
}));
mock.module('../../../../../src/config.js', () => ({
    config: { BOT_TOKEN: 'test-bot-token', SECRET_TOKEN: 'test-secret' },
}));
mock.module('../../../../../src/utils/messageUtils.js', () => ({
    mapTelegramMessageToSavedMessage: mock(() => ({})),
}));

const { POST } = await import('./route.js');

describe('POST /api/conversations/[userId]/reply', () => {
    beforeEach(() => {
        mock.restore();
        mockSendReplyToUser.mockResolvedValue('msg_sent_001');
        mockSaveMessage.mockResolvedValue({
            id: 'msg_sent_001',
            text: 'Hi!',
            timestamp: '2023-01-01T00:00:00.000Z',
            type: 'admin',
        });
        mockSaveThread.mockResolvedValue({});
        mockGetThreadByUserId.mockResolvedValue({
            createdAt: '2023-01-01T00:00:00.000Z',
            lastMessageId: 'msg_000',
            name: 'Test User',
            threadId: '11111',
            updatedAt: '2023-01-01T00:00:00.000Z',
            userId: '123456',
        });
        mockGetDb.mockResolvedValue({
            getThreadByUserId: mockGetThreadByUserId,
            saveMessage: mockSaveMessage,
            saveThread: mockSaveThread,
        });
    });

    const makeRequest = (body: Record<string, any>) =>
        new NextRequest('http://localhost/api/conversations/123456/reply', {
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
        });

    it('should send message and save to DB on success', async () => {
        const req = makeRequest({ text: 'Hi there!' });
        const res = await POST(req, { params: Promise.resolve({ userId: '123456' }) });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.ok).toBe(true);
        expect(data.messageId).toBeDefined();
        expect(mockSendReplyToUser).toHaveBeenCalledWith('123456', 'Hi there!');
        expect(mockSaveMessage).toHaveBeenCalled();
        expect(mockSaveThread).toHaveBeenCalled();
    });

    it('should return 400 when text is missing', async () => {
        const req = makeRequest({});
        const res = await POST(req, { params: Promise.resolve({ userId: '123456' }) });
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.ok).toBe(false);
        expect(mockSendReplyToUser).not.toHaveBeenCalled();
    });

    it('should return 400 when text is empty string', async () => {
        const req = makeRequest({ text: '   ' });
        const res = await POST(req, { params: Promise.resolve({ userId: '123456' }) });
        expect(res.status).toBe(400);
    });

    it('should return 404 when thread not found', async () => {
        mockGetThreadByUserId.mockResolvedValue(undefined);
        const req = makeRequest({ text: 'Hello' });
        const res = await POST(req, { params: Promise.resolve({ userId: '999999' }) });
        expect(res.status).toBe(404);
        const data = await res.json();
        expect(data.ok).toBe(false);
        expect(mockSendReplyToUser).not.toHaveBeenCalled();
    });

    it('should return 500 when Telegram API fails — does not save to DB', async () => {
        mockSendReplyToUser.mockRejectedValue(new Error('Telegram error'));
        const req = makeRequest({ text: 'Hello' });
        const res = await POST(req, { params: Promise.resolve({ userId: '123456' }) });
        expect(res.status).toBe(500);
        const data = await res.json();
        expect(data.ok).toBe(false);
        expect(mockSaveMessage).not.toHaveBeenCalled();
    });

    it('should return 500 when DB save fails after Telegram send', async () => {
        mockSaveMessage.mockRejectedValue(new Error('DB error'));
        const req = makeRequest({ text: 'Hello' });
        const res = await POST(req, { params: Promise.resolve({ userId: '123456' }) });
        expect(res.status).toBe(500);
        const data = await res.json();
        expect(data.ok).toBe(false);
        expect(data.error).toBe('DB error');
    });
});

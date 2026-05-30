import { beforeEach, describe, expect, it, mock } from 'bun:test';

const mockThread = {
    threadId: '123',
    userId: '456',
    name: 'Test User',
    lastMessageId: '10',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
};

const mockMessages = [
    {
        id: '1',
        chatId: '456',
        text: 'Hello',
        timestamp: '2024-01-01T00:00:00Z',
        type: 'user' as const,
        from: { userId: '456' },
    },
];

const mockDb = {
    getThreadByUserId: mock(() => Promise.resolve(mockThread)),
    getMessagesByUserId: mock(() => Promise.resolve(mockMessages)),
};

mock.module('../../../../lib/db/index.js', () => ({
    getDataService: mock(() => mockDb),
}));

import { GET } from './route.js';

describe('conversations [userId] GET', () => {
    beforeEach(() => {
        mockDb.getThreadByUserId.mockClear();
        mockDb.getMessagesByUserId.mockClear();
    });

    it('returns thread and messages when thread exists', async () => {
        const req = new Request('http://localhost/api/conversations/456');
        const response = await GET(req as any, { params: Promise.resolve({ userId: '456' }) });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.thread).toEqual(mockThread);
        expect(data.messages).toEqual(mockMessages);
        expect(mockDb.getThreadByUserId).toHaveBeenCalledWith('456');
        expect(mockDb.getMessagesByUserId).toHaveBeenCalledWith('456');
    });

    it('returns 404 when thread not found', async () => {
        mockDb.getThreadByUserId.mockResolvedValueOnce(undefined);

        const req = new Request('http://localhost/api/conversations/999');
        const response = await GET(req as any, { params: Promise.resolve({ userId: '999' }) });
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe('Thread not found');
        expect(mockDb.getMessagesByUserId).not.toHaveBeenCalled();
    });

    it('handles db error with 500', async () => {
        mockDb.getThreadByUserId.mockRejectedValueOnce(new Error('DB error'));

        const req = new Request('http://localhost/api/conversations/456');
        const response = await GET(req as any, { params: Promise.resolve({ userId: '456' }) });
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('DB error');
    });
});

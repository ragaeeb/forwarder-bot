import { beforeEach, describe, expect, it, mock } from 'bun:test';

const mockDb = {
    getAllThreads: mock(() => Promise.resolve([])),
    getThreadCount: mock(() => Promise.resolve(0)),
};

mock.module('../../../lib/db/index.js', () => ({
    getDataService: mock(() => mockDb),
}));

import { GET } from './route.js';

describe('conversations GET', () => {
    beforeEach(() => {
        mockDb.getAllThreads.mockClear();
        mockDb.getThreadCount.mockClear();
    });

    it('returns paginated thread list with default params', async () => {
        const threads = [
            {
                threadId: '1',
                userId: '123',
                name: 'User 1',
                lastMessageId: '10',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-02T00:00:00Z',
            },
        ];
        mockDb.getAllThreads.mockResolvedValueOnce(threads);
        mockDb.getThreadCount.mockResolvedValueOnce(1);

        const req = new Request('http://localhost/api/conversations');
        const response = await GET(req);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.threads).toEqual(threads);
        expect(data.total).toBe(1);
        expect(mockDb.getAllThreads).toHaveBeenCalledWith({ limit: 20, offset: 0 });
    });

    it('passes limit and offset from query params', async () => {
        mockDb.getAllThreads.mockResolvedValueOnce([]);
        mockDb.getThreadCount.mockResolvedValueOnce(0);

        const req = new Request('http://localhost/api/conversations?limit=10&offset=5');
        const response = await GET(req);

        expect(response.status).toBe(200);
        expect(mockDb.getAllThreads).toHaveBeenCalledWith({ limit: 10, offset: 5 });
    });

    it('returns empty list when database has no threads', async () => {
        mockDb.getAllThreads.mockResolvedValueOnce([]);
        mockDb.getThreadCount.mockResolvedValueOnce(0);

        const req = new Request('http://localhost/api/conversations');
        const response = await GET(req);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.threads).toEqual([]);
        expect(data.total).toBe(0);
    });

    it('handles db error with 500', async () => {
        mockDb.getAllThreads.mockRejectedValueOnce(new Error('DB connection failed'));

        const req = new Request('http://localhost/api/conversations');
        const response = await GET(req);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('DB connection failed');
    });
});

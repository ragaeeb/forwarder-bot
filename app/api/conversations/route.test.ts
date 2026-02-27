import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { NextRequest } from 'next/server';

const mockGetAllThreads = mock(() => Promise.resolve([]));
const mockGetThreadCount = mock(() => Promise.resolve(0));
const mockGetDb = mock(() =>
    Promise.resolve({
        getAllThreads: mockGetAllThreads,
        getThreadCount: mockGetThreadCount,
    }),
);

mock.module('../../../lib/db/index.js', () => ({
    getDb: mockGetDb,
}));

const { GET } = await import('./route.js');

describe('GET /api/conversations', () => {
    const sampleThreads = [
        {
            createdAt: '2023-01-01T00:00:00.000Z',
            lastMessageId: 'msg_001',
            name: 'Test User',
            threadId: '11111',
            updatedAt: '2023-01-02T00:00:00.000Z',
            userId: '123456',
        },
    ];

    beforeEach(() => {
        mock.restore();
        mockGetAllThreads.mockResolvedValue([]);
        mockGetThreadCount.mockResolvedValue(0);
        mockGetDb.mockResolvedValue({
            getAllThreads: mockGetAllThreads,
            getThreadCount: mockGetThreadCount,
        });
    });

    it('should return threads and total', async () => {
        mockGetAllThreads.mockResolvedValue(sampleThreads);
        mockGetThreadCount.mockResolvedValue(1);
        const req = new NextRequest('http://localhost/api/conversations');
        const res = await GET(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.threads).toEqual(sampleThreads);
        expect(data.total).toBe(1);
    });

    it('should handle empty database', async () => {
        const req = new NextRequest('http://localhost/api/conversations');
        const res = await GET(req);
        const data = await res.json();
        expect(data.threads).toEqual([]);
        expect(data.total).toBe(0);
    });

    it('should pass limit and offset from query params', async () => {
        const req = new NextRequest('http://localhost/api/conversations?limit=10&offset=5');
        await GET(req);
        expect(mockGetAllThreads).toHaveBeenCalledWith({ limit: 10, offset: 5 });
    });

    it('should default to limit=20 and offset=0', async () => {
        const req = new NextRequest('http://localhost/api/conversations');
        await GET(req);
        expect(mockGetAllThreads).toHaveBeenCalledWith({ limit: 20, offset: 0 });
    });

    it('should return 500 when getAllThreads throws', async () => {
        mockGetDb.mockResolvedValue({
            getAllThreads: mock(() => Promise.reject(new Error('DB failure'))),
            getThreadCount: mockGetThreadCount,
        });
        const req = new NextRequest('http://localhost/api/conversations');
        const res = await GET(req);
        expect(res.status).toBe(500);
        const data = await res.json();
        expect(data.ok).toBe(false);
        expect(data.error).toBe('DB failure');
    });

    it('should return 500 when getDb throws', async () => {
        mockGetDb.mockRejectedValue(new Error('Cannot connect'));
        const req = new NextRequest('http://localhost/api/conversations');
        const res = await GET(req);
        expect(res.status).toBe(500);
    });
});

import { beforeEach, describe, expect, it, mock } from 'bun:test';

const mockSettings = {
    adminGroupId: '-100123',
    setupAt: '2024-01-01T00:00:00Z',
    setupBy: { id: 1, first_name: 'Admin', is_bot: false },
    greeting: 'Hello!',
    ack: 'Message received',
    failure: 'Something went wrong',
};

const mockDb = {
    getSettings: mock(() => Promise.resolve(mockSettings)),
    saveSettings: mock((s: typeof mockSettings) => Promise.resolve(s)),
};

mock.module('../../../lib/db/index.js', () => ({
    getDataService: mock(() => mockDb),
}));

import { GET, PUT } from './route.js';

describe('settings API', () => {
    beforeEach(() => {
        mockDb.getSettings.mockClear();
        mockDb.saveSettings.mockClear();
    });

    describe('GET', () => {
        it('returns current settings', async () => {
            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual(mockSettings);
            expect(mockDb.getSettings).toHaveBeenCalled();
        });

        it('returns 404 when settings not found', async () => {
            mockDb.getSettings.mockResolvedValueOnce(undefined);

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error).toBe('Settings not found');
        });

        it('handles db error with 500', async () => {
            mockDb.getSettings.mockRejectedValueOnce(new Error('DB error'));

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe('DB error');
        });
    });

    describe('PUT', () => {
        it('saves and returns updated settings', async () => {
            const updates = { greeting: 'New greeting' };
            mockDb.saveSettings.mockResolvedValueOnce({ ...mockSettings, ...updates });

            const req = new Request('http://localhost/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });

            const response = await PUT(req);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.greeting).toBe('New greeting');
            expect(mockDb.saveSettings).toHaveBeenCalledWith(expect.objectContaining(updates));
        });

        it('returns 404 when settings not found', async () => {
            mockDb.getSettings.mockResolvedValueOnce(undefined);

            const req = new Request('http://localhost/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ greeting: 'Hi' }),
            });

            const response = await PUT(req);
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error).toBe('Settings not found');
            expect(mockDb.saveSettings).not.toHaveBeenCalled();
        });

        it('returns 400 for invalid JSON', async () => {
            const req = new Request('http://localhost/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: 'invalid json',
            });

            const response = await PUT(req);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('Invalid JSON body');
        });
    });
});

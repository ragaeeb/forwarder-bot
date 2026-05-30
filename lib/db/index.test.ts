import { beforeEach, describe, expect, it, mock } from 'bun:test';

let mockConfig: Record<string, unknown> = {};

mock.module('@/config.js', () => ({
    config: new Proxy(
        {},
        {
            get(_target, prop: string) {
                return mockConfig[prop];
            },
        },
    ),
}));

describe('getDataService', () => {
    beforeEach(() => {
        const g = globalThis as unknown as { __dataService: unknown };
        g.__dataService = undefined;
    });

    it('should return a SQLiteDataService for sqlite driver', () => {
        mockConfig = { DB_DRIVER: 'sqlite', SQLITE_PATH: ':memory:' };

        const { getDataService } = require('./index.js');
        const g = globalThis as unknown as { __dataService: unknown };
        g.__dataService = undefined;

        const db = getDataService();
        expect(db).toBeDefined();
        expect(db.getSettings).toBeInstanceOf(Function);
        expect(db.saveSettings).toBeInstanceOf(Function);
        expect(db.getAllThreads).toBeInstanceOf(Function);
    });

    it('should return the same singleton on subsequent calls', () => {
        mockConfig = { DB_DRIVER: 'sqlite', SQLITE_PATH: ':memory:' };

        const { getDataService } = require('./index.js');
        const g = globalThis as unknown as { __dataService: unknown };
        g.__dataService = undefined;

        const db1 = getDataService();
        const db2 = getDataService();
        expect(db1).toBe(db2);
    });

    it('should throw for unknown driver', () => {
        mockConfig = { DB_DRIVER: 'redis' };

        const { getDataService } = require('./index.js');
        const g = globalThis as unknown as { __dataService: unknown };
        g.__dataService = undefined;

        expect(() => getDataService()).toThrow('Unknown DB_DRIVER');
    });
});

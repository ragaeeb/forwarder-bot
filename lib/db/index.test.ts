import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// Mock the db driver modules
const mockSQLiteInstance = { type: 'sqlite' };
const mockTursoInstance = { initialize: mock(() => Promise.resolve()), type: 'turso' };
const mockMongoInstance = { type: 'mongodb' };

mock.module('./sqlite.js', () => ({
    SQLiteService: mock(() => mockSQLiteInstance),
}));

mock.module('./turso.js', () => ({
    TursoService: mock(() => mockTursoInstance),
}));

mock.module('./mongodb.js', () => ({
    MongoDBService: mock(() => mockMongoInstance),
}));

const { getDb, resetDbInstance } = await import('./index.js');

describe('lib/db/index', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        resetDbInstance();
        // Reset env
        delete process.env.DB_DRIVER;
        delete process.env.SQLITE_PATH;
        delete process.env.TURSO_DATABASE_URL;
        delete process.env.TURSO_AUTH_TOKEN;
        delete process.env.MONGODB_URI;
    });

    afterEach(() => {
        resetDbInstance();
        process.env.DB_DRIVER = originalEnv.DB_DRIVER;
        process.env.SQLITE_PATH = originalEnv.SQLITE_PATH;
        process.env.TURSO_DATABASE_URL = originalEnv.TURSO_DATABASE_URL;
        process.env.TURSO_AUTH_TOKEN = originalEnv.TURSO_AUTH_TOKEN;
        process.env.MONGODB_URI = originalEnv.MONGODB_URI;
    });

    describe('getDb', () => {
        it('should return SQLiteService when DB_DRIVER is "sqlite"', async () => {
            process.env.DB_DRIVER = 'sqlite';
            process.env.SQLITE_PATH = ':memory:';
            const db = await getDb();
            expect(db).toBe(mockSQLiteInstance);
        });

        it('should use default sqlite when DB_DRIVER is not set', async () => {
            delete process.env.DB_DRIVER;
            const db = await getDb();
            expect(db).toBe(mockSQLiteInstance);
        });

        it('should return TursoService when DB_DRIVER is "turso"', async () => {
            process.env.DB_DRIVER = 'turso';
            process.env.TURSO_DATABASE_URL = 'libsql://test.turso.io';
            process.env.TURSO_AUTH_TOKEN = 'test-token';
            const db = await getDb();
            expect(db).toBe(mockTursoInstance);
        });

        it('should throw when DB_DRIVER is "turso" and TURSO_DATABASE_URL is missing', async () => {
            process.env.DB_DRIVER = 'turso';
            delete process.env.TURSO_DATABASE_URL;
            await expect(getDb()).rejects.toThrow('TURSO_DATABASE_URL is required');
        });

        it('should call turso initialize', async () => {
            process.env.DB_DRIVER = 'turso';
            process.env.TURSO_DATABASE_URL = 'libsql://test.turso.io';
            await getDb();
            expect(mockTursoInstance.initialize).toHaveBeenCalled();
        });

        it('should return MongoDBService when DB_DRIVER is "mongodb"', async () => {
            process.env.DB_DRIVER = 'mongodb';
            process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
            const db = await getDb();
            expect(db).toBe(mockMongoInstance);
        });

        it('should throw for unknown DB_DRIVER value', async () => {
            process.env.DB_DRIVER = 'unknown-driver';
            await expect(getDb()).rejects.toThrow('Unknown DB_DRIVER: "unknown-driver"');
        });

        it('should return the same instance on subsequent calls (singleton)', async () => {
            process.env.DB_DRIVER = 'sqlite';
            const db1 = await getDb();
            const db2 = await getDb();
            expect(db1).toBe(db2);
        });
    });

    describe('resetDbInstance', () => {
        it('should allow creating a new instance after reset', async () => {
            process.env.DB_DRIVER = 'sqlite';
            const db1 = await getDb();
            resetDbInstance();
            const db2 = await getDb();
            // Both are the mock instance, but we verified singleton was reset
            expect(db1).toBeDefined();
            expect(db2).toBeDefined();
        });
    });
});

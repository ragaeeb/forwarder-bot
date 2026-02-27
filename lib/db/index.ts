import type { DataService } from '../../src/services/types.js';

// Module-level singleton — safe for Next.js hot reload in dev
let _instance: DataService | null = null;

/**
 * Returns the correct DataService singleton based on the DB_DRIVER env var.
 * Safe to call from Next.js server components and API routes.
 */
export async function getDb(): Promise<DataService> {
    if (_instance) return _instance;

    const driver = process.env.DB_DRIVER ?? 'sqlite';

    if (driver === 'sqlite') {
        const { SQLiteService } = await import('./sqlite.js');
        const path = process.env.SQLITE_PATH ?? './data/forwarder.db';
        _instance = new SQLiteService(path);
        return _instance;
    }

    if (driver === 'turso') {
        const { TursoService } = await import('./turso.js');
        const url = process.env.TURSO_DATABASE_URL;
        const authToken = process.env.TURSO_AUTH_TOKEN;
        if (!url) throw new Error('TURSO_DATABASE_URL is required when DB_DRIVER=turso');
        const svc = new TursoService(url, authToken);
        await svc.initialize();
        _instance = svc;
        return _instance;
    }

    if (driver === 'mongodb') {
        const { MongoDBService } = await import('./mongodb.js');
        const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/forwarder-bot';
        _instance = new MongoDBService(uri);
        return _instance;
    }

    throw new Error(`Unknown DB_DRIVER: "${driver}". Valid values are "sqlite", "turso", or "mongodb".`);
}

/**
 * Resets the singleton instance. Used in tests.
 */
export function resetDbInstance(): void {
    _instance = null;
}

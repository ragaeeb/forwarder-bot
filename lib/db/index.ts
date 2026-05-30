import { config } from '@/config';
import type { DataService } from '@/services/types';

const globalForDb = globalThis as unknown as { __dataService: DataService | undefined };

export function getDataService(): DataService {
    if (!globalForDb.__dataService) {
        switch (config.DB_DRIVER) {
            case 'sqlite': {
                const { SQLiteDataService } = require('./sqlite');
                globalForDb.__dataService = new SQLiteDataService(config.SQLITE_PATH);
                break;
            }
            case 'turso': {
                const { TursoDataService } = require('./turso');
                const service = new TursoDataService({
                    url: config.TURSO_DATABASE_URL!,
                    authToken: config.TURSO_AUTH_TOKEN!,
                });
                service.initialize();
                globalForDb.__dataService = service;
                break;
            }
            case 'mongodb': {
                const { MongoDataService } = require('./mongodb');
                const service = new MongoDataService({ uri: config.MONGODB_URI! });
                service.connect();
                globalForDb.__dataService = service;
                break;
            }
            default:
                throw new Error(`Unknown DB_DRIVER: "${config.DB_DRIVER}". Expected "sqlite", "turso", or "mongodb".`);
        }
    }
    return globalForDb.__dataService!;
}

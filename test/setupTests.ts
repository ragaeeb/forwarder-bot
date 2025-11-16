import { vi } from 'vitest';

process.env.BOT_CONFIGS = JSON.stringify([{ secretToken: 'test-secret-token', token: 'BT' }]);
process.env.TABLE_NAME = 'test-table';
process.env.DATABASE_PROVIDER = process.env.DATABASE_PROVIDER || 'mock';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/test';
process.env.MONGODB_DB = process.env.MONGODB_DB || 'test-db';

vi.mock('@/utils/logger', () => ({
    default: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
}));

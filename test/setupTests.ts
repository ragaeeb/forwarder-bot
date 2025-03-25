import { vi } from 'vitest';

vi.mock('@/utils/logger', () => ({
    default: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
}));

vi.mock('@/config.js', () => ({
    config: {
        BOT_TOKEN: 'BT',
        SECRET_TOKEN: 'test-secret-token',
        TABLE_NAME: 'test-table',
    },
}));

import { mock } from 'bun:test';

mock.module('@/utils/logger', () => ({
    default: {
        debug: mock(() => {}),
        error: mock(() => {}),
        info: mock(() => {}),
        warn: mock(() => {}),
    },
}));

mock.module('@/config.js', () => ({
    config: {
        BOT_TOKEN: 'BT',
        SECRET_TOKEN: 'test-secret-token',
        TABLE_NAME: 'test-table',
    },
}));

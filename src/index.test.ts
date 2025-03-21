import process from 'node:process';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('gramio', () => {
    const mockBot = {
        start: vi.fn().mockResolvedValue({ username: 'test_bot' }),
        stop: vi.fn().mockResolvedValue(undefined),
        use: vi.fn().mockReturnThis(),
    };

    return {
        Bot: vi.fn().mockImplementation(() => mockBot),
    };
});

vi.mock('./config.js', () => ({
    config: {
        BOT_TOKEN: 'test-token',
        SECRET_TOKEN: 'test-secret',
    },
}));

vi.mock('./services/mockDataService.js', () => ({
    MockDataService: vi.fn().mockImplementation(() => ({
        getSettings: vi.fn().mockResolvedValue(null),
    })),
}));

vi.mock('./webhook.js', () => ({
    handler: vi.fn().mockResolvedValue({
        body: JSON.stringify({ ok: true }),
        statusCode: 200,
    }),
    setMockDatabase: vi.fn(),
}));

vi.mock('./utils/logger.js', () => ({
    default: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
}));

const mockExit = vi.fn();
const mockOn = vi.fn();

const originalExit = process.exit;
const originalOn = process.on;

describe('index', () => {
    beforeEach(() => {
        process.exit = mockExit as any;
        process.on = mockOn;

        vi.clearAllMocks();
    });

    afterEach(() => {
        process.exit = originalExit;
        process.on = originalOn;

        vi.resetModules();
    });

    it('should initialize the bot and set up components correctly', async () => {
        await import('./index.js');

        const { Bot } = await import('gramio');
        const { MockDataService } = await import('./services/mockDataService.js');
        const { setMockDatabase } = await import('./webhook.js');

        expect(Bot).toHaveBeenCalledWith('test-token');
        expect(MockDataService).toHaveBeenCalled();
        expect(setMockDatabase).toHaveBeenCalled();

        expect(mockOn).toHaveBeenCalledWith('SIGINT', expect.any(Function));
        expect(mockOn).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });

    it('should use middleware to pass updates to webhook handler', async () => {
        await import('./index.js');

        const { Bot } = await import('gramio');
        const { handler } = await import('./webhook.js');

        const mockBot = (Bot as Mock).mock.results[0].value;
        const useMiddleware = mockBot.use.mock.calls[0][0];

        const mockCtx = {
            update: { message: { text: 'test message' }, update_id: 123 },
        };

        await useMiddleware(mockCtx);

        expect(handler).toHaveBeenCalledWith(
            expect.objectContaining({
                body: JSON.stringify(mockCtx.update),
                headers: { 'x-telegram-bot-api-secret-token': 'test-secret' },
            }),
        );
    });

    it('should start the bot', async () => {
        await import('./index.js');

        const { Bot } = await import('gramio');
        const mockBot = (Bot as Mock).mock.results[0].value;

        expect(mockBot.start).toHaveBeenCalled();
    });

    it('should handle clean shutdown', async () => {
        await import('./index.js');

        const { Bot } = await import('gramio');
        const mockBot = (Bot as Mock).mock.results[0].value;

        const [, sigintHandler] = mockOn.mock.calls.find((call) => call[0] === 'SIGINT') || [];

        await sigintHandler();

        expect(mockBot.stop).toHaveBeenCalled();

        expect(mockExit).toHaveBeenCalledWith(0);
    });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

describe('config', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('should throw an error if BOT_TOKEN is not set', async () => {
        vi.stubEnv('BOT_TOKEN', undefined);
        await expect(import('./config.js')).rejects.toThrow(expect.any(Error));
    });
});

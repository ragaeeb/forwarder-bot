import { expect, test } from 'bun:test';

const runVitest = (): void => {
    const result = Bun.spawnSync({
        cmd: ['bun', 'run', 'test'],
        stdout: 'pipe',
        stderr: 'pipe',
        env: Bun.env,
    });

    if (result.stdout.length > 0) {
        process.stdout.write(result.stdout);
    }

    if (result.stderr.length > 0) {
        process.stderr.write(result.stderr);
    }

    expect(result.success).toBe(true);
};

test('Vitest suite passes', runVitest, 120_000);

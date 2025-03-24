import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
        },
    },
    test: {
        coverage: {
            include: ['src/**/*.{ts,tsx,js,jsx}'],
        },
        environment: 'node',
        include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
        setupFiles: ['./test/setupTests.ts'],
    },
});

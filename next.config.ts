import { resolve } from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    serverExternalPackages: ['pino', 'pino-pretty', 'better-sqlite3'],
    webpack: (config) => {
        config.resolve = config.resolve || {};
        config.resolve.alias = {
            ...config.resolve.alias,
            '~': resolve(import.meta.dirname),
        };
        config.resolve.extensionAlias = {
            '.js': ['.ts', '.tsx', '.js', '.jsx'],
        };
        return config;
    },
    turbopack: {
        resolveAlias: {
            '~/*': './*',
        },
    },
};

export default nextConfig;

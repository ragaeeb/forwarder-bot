import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { config, type BotEnvironmentConfig } from '../src/config.js';
import { hashToken } from '../src/utils/security.js';
import { initWebhook, resetHook } from '../src/webhook.js';

interface CliOptions {
    token?: string;
}

const parseCliOptions = (): CliOptions => {
    const tokenFlagIndex = process.argv.indexOf('--token');

    if (tokenFlagIndex !== -1 && process.argv[tokenFlagIndex + 1]) {
        return { token: process.argv[tokenFlagIndex + 1] };
    }

    return {};
};

const resolveBotConfig = (token?: string): BotEnvironmentConfig => {
    if (token) {
        const botConfig = config.botsByToken[token];

        if (!botConfig) {
            throw new Error(`No bot configuration found for token ${token}`);
        }

        return botConfig;
    }

    if (!config.defaultBot) {
        throw new Error('No bot tokens configured. Set BOT_CONFIGS or BOT_TOKEN environment variables.');
    }

    return config.defaultBot;
};

/**
 * Retrieves the API URL from the Serverless deployment metadata file.
 *
 * @returns {Promise<string|undefined>} The API URL or undefined if not found
 */
const getApiUrl = async () => {
    type Meta = { serviceProviderAwsCfStackOutputs: { OutputKey: string; OutputValue: string }[] };

    const data: Record<string, Meta> = JSON.parse(
        await fs.readFile(path.format({ dir: '.serverless', ext: '.json', name: 'meta' }), 'utf-8'),
    );
    const [meta] = Object.values(data);

    const apiUrl = meta?.serviceProviderAwsCfStackOutputs.find(
        (output) => output.OutputKey === 'HttpApiUrl',
    )?.OutputValue;

    return apiUrl;
};

const getHashedToken = (token: string) => hashToken(token);

/**
 * Sets up the webhook for the Telegram bot.
 * Configures the webhook URL and displays setup instructions.
 *
 * @returns {Promise<void>}
 */
const setupWebhook = async (botConfig: BotEnvironmentConfig) => {
    if (!botConfig.secretToken) {
        console.error(
            `SECRET_TOKEN not set for the selected bot. You can set ${crypto.randomUUID()} in the environment variable.`,
        );

        return;
    }

    const apiUrl = await getApiUrl();

    if (apiUrl) {
        const success = await initWebhook(apiUrl, botConfig.token);

        if (success) {
            console.log('Successfully set webhook');
            console.log(
                `Let the admin create a Telegram group, enable Topics, add the bot in there as an admin who can manage topics and messages, then send the following message in the group:\n/setup ${getHashedToken(botConfig.token)}`,
            );
        } else {
            console.error('Webhook could not be set.');
        }
    } else {
        console.error('API url could not be detected. Please build the project.');
    }
};

const { token } = parseCliOptions();

try {
    const botConfig = resolveBotConfig(token);
    const command = process.argv[2];

    if (command === '--reset') {
        console.log('Resetting webhook...');
        const success = await resetHook(botConfig.token);

        if (success) {
            console.log('Successfully deleted webhook');
        } else {
            console.error('Webhook could not be deleted.');
        }
    } else if (command === '--setup') {
        console.log('Setting webhook...');
        await setupWebhook(botConfig);
    } else if (command === '--reveal') {
        console.log(getHashedToken(botConfig.token));
    }
} catch (error: any) {
    console.error(error.message || String(error));
    process.exitCode = 1;
}

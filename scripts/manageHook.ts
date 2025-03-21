import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { config } from '../src/config.js';
import { hashToken } from '../src/utils/security.js';
import { initWebhook, resetHook } from '../src/webhook.js';

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

/**
 * Gets the hashed bot token for setup verification.
 *
 * @returns {string} Hashed bot token
 */
const getHashedToken = () => hashToken(config.BOT_TOKEN);

/**
 * Sets up the webhook for the Telegram bot.
 * Configures the webhook URL and displays setup instructions.
 *
 * @returns {Promise<void>}
 */
const setupWebhook = async () => {
    if (!config.SECRET_TOKEN) {
        console.error(
            `SECRET_TOKEN not set to validate webhook callbacks, you can set ${crypto.randomUUID()} in your environment variable.`,
        );

        return;
    }

    const apiUrl = await getApiUrl();

    if (apiUrl) {
        const success = await initWebhook(apiUrl);

        if (success) {
            console.log('Successfully set webhook');
            console.log(
                `Let the admin create a Telegram group, enable Topics, add the bot in there as an admin who can manage topics and messages, then send the following message in the group:\n/setup ${getHashedToken()}`,
            );
        } else {
            console.error('Webhook could not be set.');
        }
    } else {
        console.error('API url could not be detected. Please build the project.');
    }
};

if (process.argv[2] === '--reset') {
    console.log('Resetting webhook...');
    const success = await resetHook();

    if (success) {
        console.log('Successfully deleted webhook');
    } else {
        console.error('Webhook could not be deleted.');
    }
} else if (process.argv[2] === '--setup') {
    console.log('Setting webhook...');
    await setupWebhook();
} else if (process.argv[2] === '--reveal') {
    console.log(getHashedToken());
}

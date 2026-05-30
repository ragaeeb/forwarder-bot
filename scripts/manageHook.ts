import crypto from 'node:crypto';

import { config } from '../src/config.js';
import { hashToken } from '../src/utils/security.js';
import { initWebhook, resetHook } from '../src/webhook.js';

const getApiUrl = () => {
    const base = config.NEXTAUTH_URL.replace(/\/$/, '');
    return `${base}/api/webhook`;
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

    const apiUrl = getApiUrl();

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

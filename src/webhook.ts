import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import logger from '@/utils/logger.js';

import type { DataService } from './services/types.js';

import { Bot } from './bot.js';
import { config } from './config.js';
import { registerHandlers } from './handlers/index.js';
import { DynamoDBService } from './services/dynamodb.js';
import { TelegramAPI } from './services/telegramAPI.js';

let mockDatabase: DataService | undefined;
let bot: Bot | undefined;

/**
 * Sets a mock database for testing purposes.
 * This allows injecting a test database implementation during testing.
 *
 * @param {DataService} db - The mock database service to use
 */
export const setMockDatabase = (db: DataService) => {
    mockDatabase = db;
};

const initBot = async () => {
    logger.info('Starting bot');
    const myBot = new Bot(config.BOT_TOKEN);

    logger.info(`Bot started, starting data service`);
    const db = mockDatabase || new DynamoDBService();

    logger.info(`register handlers`);
    registerHandlers(myBot, db);

    return myBot;
};

/**
 * AWS Lambda handler function for processing Telegram webhook events.
 * This is the main entry point for the serverless function that processes
 * Telegram bot updates via webhooks.
 *
 * @param {APIGatewayProxyEvent} event - The API Gateway event containing the webhook data
 * @returns {Promise<APIGatewayProxyResult>} The API Gateway response
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    process.on('uncaughtException', (err) => {
        logger.error(err, 'Uncaught Exception:');
        logger.error(err.stack, 'Stack trace:');
    });

    try {
        logger.info(`Webhook called: body=${event.body}`);

        if (event.headers['x-telegram-bot-api-secret-token'] !== config.SECRET_TOKEN) {
            logger.warn('Invalid secret token in webhook request');

            return {
                body: JSON.stringify({ error: 'Unauthorized', ok: false }),
                statusCode: 403,
            };
        }

        if (!bot) {
            bot = await initBot();
        }

        if (event.body) {
            logger.info(`handleUpdate`);
            await bot!.handleUpdate(JSON.parse(event.body));
        } else {
            logger.debug('Skipping update.');
        }

        logger.info(`return 200`);

        return {
            body: JSON.stringify({ ok: true }),
            statusCode: 200,
        };
    } catch (error: any) {
        logger.error(error, `Error processing webhook:`);

        return {
            body: JSON.stringify({ error: error.message || String(error), ok: false }),
            statusCode: 200, // Always return 200 to Telegram
        };
    } finally {
        logger.info(`Shutting down gracefully...`);
    }
};

/**
 * Initializes a webhook for the Telegram bot.
 * Sets up the webhook URL and configures the secret token for secure communications.
 *
 * @param {string} apiUrl - The base URL of the API Gateway endpoint
 * @returns {Promise<boolean>} True if the webhook was set successfully, false otherwise
 */
export const initWebhook = async (apiUrl: string): Promise<boolean> => {
    const telegramAPI = new TelegramAPI(config.BOT_TOKEN);

    return telegramAPI.setWebhook({
        drop_pending_updates: true,
        secret_token: config.SECRET_TOKEN,
        url: `${apiUrl}/${config.BOT_TOKEN}`,
    });
};

/**
 * Deletes the webhook configuration for the Telegram bot.
 * This stops the bot from receiving updates via webhooks.
 *
 * @returns {Promise<boolean>} True if the webhook was deleted successfully, false otherwise
 */
export const resetHook = async (): Promise<boolean> => {
    const telegramAPI = new TelegramAPI(config.BOT_TOKEN);

    return telegramAPI.deleteWebhook({
        drop_pending_updates: true,
    });
};

import { Bot } from 'gramio';
import process from 'node:process';

import { config } from './config.js';
import { MockDataService } from './services/mockDataService.js';
import logger from './utils/logger.js';
import { handler, setMockDatabase } from './webhook.js';

logger.info(`index.ts dev entry point`);

/**
 * Set up a mock database for development mode
 */
setMockDatabase(new MockDataService());

/**
 * Creates a mock API Gateway event from a Telegram update
 * This allows reusing the webhook handler for local development
 *
 * @param {any} update - Telegram update object
 * @returns {Object} Mocked API Gateway event
 */
const createMockEvent = (update: any) => ({
    body: JSON.stringify(update),
    headers: { 'x-telegram-bot-api-secret-token': config.SECRET_TOKEN },
    httpMethod: 'POST',
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    path: `/${config.BOT_TOKEN}`,
    pathParameters: { token: config.BOT_TOKEN },
    queryStringParameters: null,
    requestContext: {} as any,
    resource: '',
    stageVariables: null,
});

/**
 * Create a bot instance for development mode
 * This bot uses polling and passes updates to the webhook handler
 */
const bot = new Bot(config.BOT_TOKEN);

/**
 * Middleware to intercept updates and pass them to the webhook handler
 * Allows using the same code for both webhook and polling modes
 */
bot.use(async (ctx) => {
    logger.debug('Intercepted update, passing to webhook handler');
    await handler(createMockEvent(ctx.update));
});

/**
 * Start the bot in polling mode for development
 * Log success or failure and handle process exit
 */
try {
    const user = await bot.start();
    logger.info(`Bot @${user?.username} started successfully`);
} catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
}

/**
 * Clean up function for graceful shutdown
 * Stops the bot and exits the process
 */
const cleanUp = async () => {
    logger.info(`Shutting down gracefully...`);
    await bot.stop();
    process.exit(0);
};

// Register signal handlers for clean shutdown
process.on('SIGINT', cleanUp);
process.on('SIGTERM', cleanUp);

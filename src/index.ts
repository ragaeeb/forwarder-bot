import process from 'node:process';

import type { TelegramUpdate } from './types/telegram.js';

import { Bot } from './bot.js';
import { config } from './config.js';
import { MockDataService } from './services/mockDataService.js';
import logger from './utils/logger.js';
import { handler, setMockDatabase } from './webhook.js';

logger.info(`index.ts dev entry point`);

/**
 * Set up a mock database for development mode
 */
const mockDb = new MockDataService();
setMockDatabase(mockDb);

/**
 * Creates a mock API Gateway event from a Telegram update
 * This allows reusing the webhook handler for local development
 *
 * @param {TelegramUpdate} update - Telegram update object
 * @returns {Object} Mocked API Gateway event
 */
const createMockEvent = (update: TelegramUpdate) => ({
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
 * Start the bot in development mode
 * Uses polling to get updates, then passes them to the webhook handler
 */
async function startDevBot() {
    try {
        const bot = new Bot(config.BOT_TOKEN);

        // Delete any existing webhook
        await bot.api.deleteWebhook({ drop_pending_updates: false });

        let lastUpdateId = 0;

        logger.info('Starting bot in development mode with polling');
        const me = await bot.api.getMe();
        logger.info(`Bot @${me.username} started`);

        // Start polling loop
        const pollUpdates = async () => {
            try {
                // Get updates with long polling
                const updates = await bot.api.getUpdates({
                    limit: 100,
                    offset: lastUpdateId > 0 ? lastUpdateId + 1 : undefined,
                    timeout: 30,
                });

                // Process each update by passing it to the webhook handler
                if (updates && updates.length > 0) {
                    logger.info(`Received ${updates.length} updates`);

                    // Update the last processed update ID to the most recent one
                    lastUpdateId = updates[updates.length - 1].update_id;

                    for (const update of updates) {
                        // Skip messages from our own bot
                        if (update.message?.from?.is_bot && update.message.from.id === me.id) {
                            logger.debug('Skipping message from self');
                            continue;
                        }

                        // Convert update to a mock API Gateway event
                        const mockEvent = createMockEvent(update);

                        // Process with webhook handler
                        await handler(mockEvent);
                    }
                }

                // Continue polling if not stopped
                setTimeout(pollUpdates, 1000);
            } catch (error) {
                logger.error('Error polling updates:', error);
                setTimeout(pollUpdates, 5000); // Retry after 5 seconds on error
            }
        };

        // Set up clean shutdown
        const cleanUp = () => {
            logger.info(`Shutting down gracefully...`);
            process.exit(0);
        };

        process.on('SIGINT', cleanUp);
        process.on('SIGTERM', cleanUp);

        // Start the polling loop
        pollUpdates();
    } catch (error) {
        logger.error('Failed to start bot:', error);
        process.exit(1);
    }
}

// Start the development bot
startDevBot();

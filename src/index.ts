import process from 'node:process';
import { setTimeout } from 'node:timers/promises';

import { Bot } from './bot.js';
import { config } from './config.js';
import { MockDataService } from './services/mockDataService.js';
import logger from './utils/logger.js';
import { isUpdateSentFromBot } from './utils/messageUtils.js';
import { handler, setMockDatabase } from './webhook.js';

/**
 * Creates a mock API Gateway event from a Telegram update
 * This allows reusing the webhook handler for local development
 *
 * @param {TelegramUpdate} update - Telegram update object
 * @returns {Object} Mocked API Gateway event
 */
const selectedBot = config.defaultBot;

if (!selectedBot) {
    throw new Error('No bot tokens configured. Set BOT_CONFIGS or BOT_TOKEN to use dev mode.');
}

const mapPayloadToApiGatewayEvent = (update: any) => ({
    body: JSON.stringify(update),
    headers: {
        ...(selectedBot.secretToken && { 'x-telegram-bot-api-secret-token': selectedBot.secretToken }),
    },
    httpMethod: 'POST',
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    path: `/${selectedBot.token}`,
    pathParameters: { token: selectedBot.token },
    queryStringParameters: null,
    requestContext: {} as any,
    resource: '',
    stageVariables: null,
});

/**
 * Single cycle of polling for updates
 *
 * @param bot - The bot instance
 * @param lastUpdateIdRef - Reference to the last update ID
 * @returns The updated last update ID
 */
const fetchAndProcessUpdates = async (bot: Bot, lastUpdateId: number | undefined): Promise<number | undefined> => {
    try {
        const updates = await bot.api.getUpdates({
            allowed_updates: ['message', 'edited_message'],
            limit: 100,
            offset: lastUpdateId !== undefined ? lastUpdateId + 1 : undefined,
            timeout: 30,
        });

        if (updates.length > 0) {
            logger.debug(`Received ${updates.length} updates`);

            // Update the last processed update ID to the most recent one
            const newLastUpdateId = updates[updates.length - 1].update_id;

            for (const update of updates) {
                if (!isUpdateSentFromBot(update)) {
                    await handler(mapPayloadToApiGatewayEvent(update));
                } else {
                    logger.debug('Skipping message from bot');
                }
            }

            return newLastUpdateId;
        }

        return lastUpdateId;
    } catch (error) {
        logger.error('Error polling updates:', error);
        return lastUpdateId; // Keep the last update ID on error
    }
};

/**
 * Continuous polling loop that doesn't create nested stacks
 */
const startPolling = async (bot: Bot) => {
    const isPolling = true;
    let lastUpdateId: number | undefined = undefined;

    // This is the main polling loop
    while (isPolling) {
        lastUpdateId = await fetchAndProcessUpdates(bot, lastUpdateId);

        // Wait between polling cycles
        await setTimeout(1000);
    }
};

const cleanUp = () => {
    logger.info(`Shutting down gracefully...`);
    process.exit(0);
};

logger.info(`index.ts dev entry point`);

const bot = new Bot(selectedBot.token);

logger.info('Starting bot in development mode with polling');
const me = await bot.api.getMe();
bot.username = me.username;

if (!me.username) {
    throw new Error('Bot username is required to initialize the mock database.');
}

const mockDb = new MockDataService(me.username);
setMockDatabase(mockDb);
logger.info(`Bot @${me.username} started`);

process.on('SIGINT', cleanUp);
process.on('SIGTERM', cleanUp);

await startPolling(bot);

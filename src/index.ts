import { Bot } from 'gramio';
import process from 'node:process';

import { config } from './config.js';
import { MockDataService } from './services/mockDataService.js';
import logger from './utils/logger.js';
import { handler, setMockDatabase } from './webhook.js';

logger.info(`index.ts dev entry point`);

setMockDatabase(new MockDataService());

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

const bot = new Bot(config.BOT_TOKEN); // to intercept updates and pass it to the webhook

bot.use(async (ctx) => {
    logger.debug('Intercepted update, passing to webhook handler');
    await handler(createMockEvent(ctx.update));
});

try {
    const user = await bot.start();
    logger.info(`Bot @${user?.username} started successfully`);
} catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
}

const cleanUp = async () => {
    logger.info(`Shutting down gracefully...`);
    await bot.stop();
    process.exit(0);
};

process.on('SIGINT', cleanUp);
process.on('SIGTERM', cleanUp);

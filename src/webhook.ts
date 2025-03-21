import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import logger from '@/utils/logger.js';
import { Bot } from 'gramio';

import { config } from './config.js';
import { registerHandlers } from './handlers/index.js';
import { DynamoDBService } from './services/dynamodb.js';
import { DataService } from './services/types.js';

let mockDatabase: DataService | undefined;

export const setMockDatabase = (db: DataService) => {
    mockDatabase = db;
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    process.on('uncaughtException', (err) => {
        logger.error(err, 'Uncaught Exception:');
        logger.error(err.stack, 'Stack trace:');
    });

    let bot;

    try {
        logger.info(`Webhook called: body=${event.body}`);

        if (event.headers['x-telegram-bot-api-secret-token'] !== config.SECRET_TOKEN) {
            logger.warn('Invalid secret token in webhook request');

            return {
                body: JSON.stringify({ error: 'Unauthorized', ok: false }),
                statusCode: 403,
            };
        }

        bot = new Bot(config.BOT_TOKEN);

        logger.info(`Starting dynamodb service`);
        const db = mockDatabase || new DynamoDBService();

        logger.info(`register handlers`);
        await registerHandlers(bot, db);

        logger.info(`Init bot`);

        // Process the update via the handler
        await bot.init();

        logger.info(`handleUpdate`);

        await bot.updates.handleUpdate(JSON.parse(event.body || '{}'));

        logger.info(`return 200`);

        return {
            body: JSON.stringify({ ok: true }),
            statusCode: 200,
        };
    } catch (error) {
        logger.error(error, `Error processing webhook:`);

        return {
            body: JSON.stringify({ error: String(error), ok: false }),
            statusCode: 200, // Always return 200 to Telegram
        };
    } finally {
        logger.info(`Shutting down gracefully...`);
        await bot?.stop();
    }
};

export const initWebhook = async (apiUrl: string) => {
    const bot = new Bot(config.BOT_TOKEN);

    return bot.api.setWebhook({
        drop_pending_updates: true,
        secret_token: config.SECRET_TOKEN,
        url: `${apiUrl}/${config.BOT_TOKEN}`,
    });
};

export const resetHook = async () => {
    const bot = new Bot(config.BOT_TOKEN);

    return bot.api.deleteWebhook({
        drop_pending_updates: true,
    });
};

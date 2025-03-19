import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import logger from '@/utils/logger.js';
import { Bot } from 'gramio';

import { config } from './config.js';
import { registerHandlers } from './handlers/index.js';
import { DynamoDBService } from './services/dynamodb.js';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    process.on('uncaughtException', (err) => {
        logger.error(err, 'Uncaught Exception:');
        logger.error(err.stack, 'Stack trace:');
    });

    try {
        logger.info(`Webhook called: method=${JSON.stringify(event)}`);

        const bot = new Bot(config.BOT_TOKEN);

        logger.info(`Starting dynamodb service`);
        const db = new DynamoDBService();

        logger.info(`register handlers`);
        registerHandlers(bot, db);

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
    }
};

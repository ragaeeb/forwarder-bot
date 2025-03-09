import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import logger from '@/utils/logger.js';
import { Bot } from 'gramio';

import { config } from './config.js';
import { registerHandlers } from './handlers/index.js';
import { DynamoDBService } from './services/dynamodb.js';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        logger.info(`Webhook called: method=${event.httpMethod}, path=${event.path}`);

        const bot = new Bot(config.BOT_TOKEN);
        const db = new DynamoDBService();

        registerHandlers(bot, db);

        await bot.updates.handleUpdate(JSON.parse(event.body || '{}'));

        return {
            body: JSON.stringify({ ok: true }),
            statusCode: 200,
        };
    } catch (error) {
        logger.error('Error processing webhook:', error);

        return {
            body: JSON.stringify({ error: String(error), ok: false }),
            statusCode: 200, // Always return 200 to Telegram
        };
    }
};

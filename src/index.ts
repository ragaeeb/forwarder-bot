import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { Bot } from 'gramio';

import { config } from './config.js';
import { registerHandlers } from './handlers.js';
import { DynamoDBService } from './services/dynamodb.js';

// Lambda handler for AWS
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        console.info('Webhook called', { method: event.httpMethod, path: event.path });

        // Parse the incoming webhook data
        const update = JSON.parse(event.body || '');

        // Initialize bot and services
        const bot = new Bot(config.BOT_TOKEN);
        const db = new DynamoDBService();

        // Register message handlers
        registerHandlers(bot, db);

        // Process the update
        await bot.updates.handleUpdate(update);

        return {
            body: JSON.stringify({ ok: true }),
            statusCode: 200,
        };
    } catch (error) {
        console.error('Error processing webhook:', error);
        return {
            body: JSON.stringify({ error: String(error), ok: false }),
            statusCode: 200, // Always return 200 to Telegram
        };
    }
};

// For local development
if (process.env.NODE_ENV === 'development') {
    const startLocalBot = async () => {
        const bot = new Bot(config.BOT_TOKEN);
        const db = new DynamoDBService();

        registerHandlers(bot, db);

        const user = await bot.start();
        console.info(`Bot @${user?.username} started successfully`);

        // Graceful shutdown
        for (const signal of ['SIGINT', 'SIGTERM']) {
            process.on(signal, async () => {
                console.info(`Received ${signal}, shutting down...`);
                await bot.stop();
                process.exit(0);
            });
        }
    };

    startLocalBot().catch((error) => {
        console.error('Failed to start bot:', error);
        process.exit(1);
    });
}

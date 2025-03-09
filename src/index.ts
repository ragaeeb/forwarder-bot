import { Bot } from 'gramio';
import process from 'node:process';

import { config } from './config.js';
import { registerHandlers } from './handlers/index.js';
import { DynamoDBService } from './services/dynamodb.js';
import logger from './utils/logger.js';

const bot = new Bot(config.BOT_TOKEN);
const db = new DynamoDBService();

registerHandlers(bot, db);

const user = await bot.start();
logger.info(`Bot @${user?.username} started successfully`);

const cleanUp = async () => {
    logger.info(`Shutting down gracefully...`);
    await bot.stop();

    process.exit(0);
};

process.on('SIGINT', cleanUp);
process.on('SIGTERM', cleanUp);

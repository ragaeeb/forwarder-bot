import type { DataService } from '@/services/types.js';
import type { Bot, Context, ContextType, DeriveDefinitions, Handler } from 'gramio';

import { onSetup } from '@/commands/setup.js';
import { onStart } from '@/commands/start.js';
import logger from '@/utils/logger.js';

import { onGenericMessage } from './genericMessage.js';
import { handleEditedMessage } from './handleEditedMessage.js';
import { ignoreSelfMessages } from './middlewares.js';

/**
 * Type for handling bot commands with context
 */
type CommandHandler = (
    context: ContextType<Bot, 'message'> &
        DeriveDefinitions['global'] &
        DeriveDefinitions['message'] & {
            args: null | string;
        },
) => unknown;

/**
 * Middleware for processing requests
 *
 */
type Middleware = Handler<Context<Bot> & DeriveDefinitions['global']>;

/**
 * Handler for processing updates
 */
type UpdateHandler = Handler<ContextType<Bot, any> & DeriveDefinitions & DeriveDefinitions['global']>;

/**
 * Register handlers and middleware for the bot
 * @param bot - Bot instance
 * @param db - DynamoDB service instance
 */
export const registerHandlers = async (bot: Bot, db: DataService) => {
    logger.info(`registerHandlers`);

    const settings = await db.getSettings();

    bot.derive(async () => {
        const me = await bot.api.getMe();

        return {
            bot,
            db,
            me,
            settings,
        };
    });

    bot.use(ignoreSelfMessages as Middleware);

    logger.info(`Registering commands`);

    bot.command('setup', onSetup as CommandHandler); // Handle setup command with token verification

    if (settings) {
        bot.command('start', onStart as CommandHandler);

        logger.info(`Registering message and edit handlers`);

        // Handle direct messages from users
        bot.on('message', onGenericMessage as UpdateHandler);
        bot.on('edited_message', handleEditedMessage as UpdateHandler);
    } else {
        logger.warn('Skipping handlers that require configuration prerequisite');
    }

    logger.info(`registerHandlers completed`);
};

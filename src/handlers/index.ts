import type { DataService } from '@/services/types.js';

import { CUSTOMIZE_COMMANDS, onCustomize } from '@/commands/customize.js';
import { onSetup } from '@/commands/setup.js';
import { onStart } from '@/commands/start.js';
import { ignoreSelfMessages, injectDependencies, requireGroupAdmin, requireSetup } from '@/middlewares/index.js';
import logger from '@/utils/logger.js';

import type { CommandHandler, UpdateHandler } from '../bot.js';

import { Bot } from '../bot.js';
import { onGenericMessage } from './genericMessage.js';
import { handleEditedMessage } from './handleEditedMessage.js';

/**
 * Register handlers and middleware for the bot.
 * Sets up command handlers, message handlers, and middleware
 * based on the bot's configuration state.
 *
 * @param {Bot} bot - Bot instance
 * @param {DataService} db - Database service instance
 * @returns {Promise<void>}
 */
export const registerHandlers = async (bot: Bot, db: DataService) => {
    logger.info(`registerHandlers`);

    // Add dependency injection middleware as the first middleware
    bot.use(injectDependencies(db));

    // Add middleware to ignore self messages
    bot.use(ignoreSelfMessages);

    logger.info(`Registering commands`);

    // Register setup command with group admin check
    bot.command('setup', requireGroupAdmin, onSetup as CommandHandler);

    // Register commands that require setup
    bot.command('start', requireSetup, onStart as CommandHandler);

    // Register customize commands with admin and setup checks
    CUSTOMIZE_COMMANDS.forEach((command) => {
        bot.command(command, requireSetup, requireGroupAdmin, onCustomize as CommandHandler);
    });

    logger.info(`Registering message and edit handlers`);

    // Register message handlers with setup check
    bot.on('message', requireSetup, onGenericMessage as UpdateHandler);
    bot.on('edited_message', requireSetup, handleEditedMessage as UpdateHandler);

    logger.info(`registerHandlers completed`);
};

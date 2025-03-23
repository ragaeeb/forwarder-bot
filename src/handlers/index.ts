import type { Bot, CommandHandler, Middleware, UpdateHandler } from '@/bot.js';
import type { DataService } from '@/services/types.js';

import { CUSTOMIZE_COMMANDS, onCustomize } from '@/commands/customize.js';
import { onSetup } from '@/commands/setup.js';
import { onStart } from '@/commands/start.js';
import {
    injectDependencies,
    requireAdminReply,
    requireParticipant,
    requirePrivateChat,
    requireSetup,
} from '@/middlewares/common.js';
import { requireGroupAdmin } from '@/middlewares/requireGroupAdmin.js';
import { requireManageTopicsPermission } from '@/middlewares/requireManageTopicsPermission.js';
import { requireReferencedThread, requireThreadForUser } from '@/middlewares/requireMessageThread.js';
import { requireNewSetup } from '@/middlewares/requireNewSetup.js';
import { requireToken } from '@/middlewares/requireToken.js';
import logger from '@/utils/logger.js';

import { onAdminReply } from './handleAdminReply.js';
import { onDirectMessage } from './handleDirectMessage.js';
import { onEditedMessage } from './handleEditedMessage.js';

/**
 * Register handlers and middleware for the bot. Sets up command handlers, message handlers, and middleware based on the bot's configuration state.
 *
 * @param {Bot} bot - Bot instance
 * @param {DataService} db - Database service instance
 * @returns {Promise<void>}
 */
export const registerHandlers = (bot: Bot, db: DataService) => {
    logger.info(`registerHandlers`);

    bot.use(injectDependencies(db) as Middleware);
    bot.use(requireParticipant);

    bot.command(
        'setup',
        requireToken as Middleware,
        requireGroupAdmin as Middleware,
        requireNewSetup as Middleware,
        requireManageTopicsPermission as Middleware,
        onSetup as CommandHandler,
    );

    bot.command('start', requireSetup as Middleware, onStart as CommandHandler);

    CUSTOMIZE_COMMANDS.forEach((command) => {
        bot.command(
            command,
            requireSetup as Middleware,
            requireGroupAdmin as Middleware,
            onCustomize as CommandHandler,
        );
    });

    bot.on(
        'message',
        requireSetup as Middleware,
        requireAdminReply as Middleware,
        requireReferencedThread as Middleware,
        onAdminReply as UpdateHandler,
    );
    bot.on(
        'message',
        requireSetup as Middleware,
        requirePrivateChat as Middleware,
        requireThreadForUser as Middleware,
        onDirectMessage as UpdateHandler,
    );
    bot.on('edited_message', requirePrivateChat, requireSetup as Middleware, onEditedMessage as UpdateHandler);
};

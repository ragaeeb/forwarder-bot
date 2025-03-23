import type { Context, NextFunction } from '@/bot.js';
import type { DataService } from '@/services/types.js';
import type { ForwardContext } from '@/types.js';

import logger from '@/utils/logger.js';

/**
 * Middleware to inject dependencies into context
 * Loads database and settings
 *
 * @param {DataService} db - Database service instance
 * @returns {Function} Middleware function
 */
export const injectDependencies = (db: DataService) => {
    return async (ctx: ForwardContext, next: NextFunction) => {
        ctx.db = db;

        try {
            const [settings, me] = await Promise.all([db.getSettings(), ctx.bot.api.getMe()]);

            ctx.settings = settings!;
            ctx.me = me;
        } catch (error) {
            logger.error('Failed to load settings or bot identity', error);
            return;
        }

        await next();
    };
};

/**
 * Middleware to verify setup is completed
 * Checks if settings exist in context
 *
 * @returns {Function} Middleware function
 */
export const requireSetup = (ctx: ForwardContext, next: () => Promise<void>) => {
    if (ctx.settings) {
        return next();
    }

    logger.warn('Bot not configured, rejecting');
};

/**
 * Middleware to ignore messages from the bot itself
 * Prevents the bot from responding to its own messages
 *
 * @returns {Function} Middleware function
 */
export const requireParticipant = (ctx: Context, next: NextFunction) => {
    if (ctx.from?.id !== ctx.me.id && !ctx.from.is_bot) {
        return next();
    }
};

/**
 * Middleware to ignore messages that are not from a DM to the bot
 * @returns {Function} Middleware function
 */
export const requirePrivateChat = (ctx: Context, next: NextFunction) => {
    if (ctx.chat.type === 'private') {
        return next();
    }

    logger.info(`Skipping non-DM edited message`);
};

export const requireAdminReply = (ctx: ForwardContext, next: NextFunction) => {
    if (
        ctx.chat.id.toString() === ctx.settings.adminGroupId &&
        ctx.chat.type === 'supergroup' &&
        ctx.message!.reply_to_message &&
        ctx.message!.message_thread_id
    ) {
        return next();
    }
};

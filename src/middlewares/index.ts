import type { Context } from '../bot.js';
import type { DataService } from '../services/types.js';
import type { ForwardContext } from '../types.js';

import logger from '../utils/logger.js';
import { replyWithWarning } from '../utils/replyUtils.js';

/**
 * Middleware to inject dependencies into context
 * Loads database and settings
 *
 * @param {DataService} db - Database service instance
 * @returns {Function} Middleware function
 */
export const injectDependencies = (db: DataService) => {
    return async (ctx: Context, next: () => Promise<void>) => {
        // Inject database
        ctx.db = db;

        // Try to load settings
        try {
            ctx.settings = await db.getSettings();
            ctx.me = await ctx.bot.api.getMe();
        } catch (error) {
            logger.error('Failed to load settings:', error);
            ctx.settings = undefined;
        }

        // Continue to next middleware or handler
        await next();
    };
};

/**
 * Middleware to verify setup is completed
 * Checks if settings exist in context
 *
 * @returns {Function} Middleware function
 */
export const requireSetup = async (ctx: ForwardContext, next: () => Promise<void>) => {
    if (!ctx.settings) {
        logger.warn('Bot not configured, rejecting command');
        return;
    }

    await next();
};

/**
 * Middleware to ignore messages from the bot itself
 * Prevents the bot from responding to its own messages
 *
 * @returns {Function} Middleware function
 */
export const ignoreSelfMessages = async (ctx: Context, next: () => Promise<void>) => {
    if (ctx.from?.id !== ctx.me.id) {
        await next();
    }
};

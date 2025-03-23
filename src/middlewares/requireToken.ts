import type { NextFunction } from '@/bot.js';
import type { ForwardContext } from '@/types.js';

import { config } from '@/config.js';
import logger from '@/utils/logger.js';
import { hashToken } from '@/utils/security.js';

/**
 * Middleware to check if sender is a group admin
 * Only allows admins in supergroups to proceed
 *
 * @returns {Function} Middleware function
 */
export const requireToken = (ctx: ForwardContext, next: NextFunction) => {
    const { args: providedToken } = ctx;

    if (providedToken === hashToken(config.BOT_TOKEN)) {
        return next();
    }

    if (providedToken) {
        logger.warn(`Invalid token provided`);
    } else {
        // don't send any reply for security purposes, we don't want them to know the structure of the setup
        logger.warn(`No token provided.`);
    }
};

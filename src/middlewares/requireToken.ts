import type { NextFunction } from '@/bot.js';
import type { ForwardContext } from '@/types/app.js';

import { config } from '@/config.js';
import logger from '@/utils/logger.js';
import { hashToken } from '@/utils/security.js';

/**
 * Middleware to verify the provided token matches the hashed bot token
 * Only allows requests with a valid token to proceed
 *
 * @param {ForwardContext} ctx - The context object containing the token
 * @param {NextFunction} next - The next middleware function to call if validation passes
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

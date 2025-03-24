import type { NextFunction } from '@/bot.js';
import type { ForwardContext } from '@/types/app.js';

import logger from '@/utils/logger.js';
import { replyWithWarning } from '@/utils/replyUtils.js';

/**
 * Validates if setup was not yet completed or if we are attempting setup on a group we already are set up on.
 * @returns {Function} Middleware function
 */
export const requireNewSetup = async (ctx: ForwardContext, next: NextFunction) => {
    if (!ctx.settings || ctx.settings.adminGroupId !== ctx.chat.id.toString()) {
        return next();
    }

    logger.info(`We were already set up with ${ctx.chat.id}`);
    await replyWithWarning(ctx, `Setup was already completed for this group.`);
};

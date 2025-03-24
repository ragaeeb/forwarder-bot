import type { NextFunction } from '@/bot.js';
import type { ForwardContext } from '@/types/app.js';

import logger from '@/utils/logger.js';
import { replyWithWarning } from '@/utils/replyUtils.js';

/**
 * Middleware to check if sender is a group admin
 * Only allows admins in supergroups to proceed
 *
 * @returns {Function} Middleware function
 */
export const requireGroupAdmin = async (ctx: ForwardContext, next: NextFunction) => {
    const { id: chatId, type } = ctx.chat;

    if (type !== 'supergroup') {
        logger.warn(`Attempted command in ${type}`);
        await replyWithWarning(ctx, 'This command must be used in a group with topics enabled');
        return;
    }

    const chatMember = await ctx.bot.api.getChatMember({
        chat_id: chatId,
        user_id: ctx.from.id,
    });

    if (!['administrator', 'creator'].includes(chatMember.status)) {
        logger.warn(`Unauthorized attempt by user ${ctx.from?.id}`);
        await replyWithWarning(ctx, 'Only group administrators can run this command');
        return;
    }

    return next();
};

import type { ForwardContext } from '@/types.js';

import logger from './logger.js';
import { replyWithWarning } from './replyUtils.js';

export const isSenderGroupAdmin = async (ctx: ForwardContext) => {
    const { id: chatId, type } = ctx.chat;

    if (type !== 'supergroup') {
        logger.warn(`Attempted command in ${type}`);
        await replyWithWarning(ctx, 'This command must be used in a group with topics enabled');
        return false;
    }

    const chatMember = await ctx.bot.api.getChatMember({
        chat_id: chatId,
        user_id: ctx.from?.id as number,
    });

    if (!['administrator', 'creator'].includes(chatMember.status)) {
        logger.warn(`Unauthorized attempt by user ${ctx.from?.id}`);
        await replyWithWarning(ctx, 'Only group administrators can run this command');
        return false;
    }

    return true;
};

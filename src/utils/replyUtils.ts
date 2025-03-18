import type { ForwardContext } from '@/types.js';

const replyWithEmoji = async (ctx: ForwardContext, emoji: string, message: string) => {
    return ctx.reply(`${emoji} ${message}`);
};

export const replyWithError = async (ctx: ForwardContext, message: string) => {
    return replyWithEmoji(ctx, '❌', message);
};

export const replyWithWarning = async (ctx: ForwardContext, message: string) => {
    return replyWithEmoji(ctx, '⚠️', message);
};

export const replyWithSuccess = async (ctx: ForwardContext, message: string) => {
    return replyWithEmoji(ctx, '✅', message);
};

export const replyWithUnknownError = async (ctx: ForwardContext) => {
    return replyWithError(ctx, 'Failed to deliver your message. Please try again later.');
};

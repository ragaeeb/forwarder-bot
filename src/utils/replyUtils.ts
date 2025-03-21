import type { ForwardContext } from '@/types.js';

/**
 * Helper function to send a reply with an emoji prefix.
 * Creates a standardized format for status messages.
 *
 * @param {ForwardContext} ctx - The context object to reply to
 * @param {string} emoji - The emoji to prefix the message with
 * @param {string} message - The text message to send
 * @returns {Promise<any>} Result of the reply operation
 */
const replyWithEmoji = async (ctx: ForwardContext, emoji: string, message: string) => {
    return ctx.reply(`${emoji} ${message}`);
};

/**
 * Sends an error message prefixed with ❌ emoji.
 * Used for notifying users of failures or errors.
 *
 * @param {ForwardContext} ctx - The context object to reply to
 * @param {string} message - The error message to send
 * @returns {Promise<any>} Result of the reply operation
 */
export const replyWithError = async (ctx: ForwardContext, message: string) => {
    return replyWithEmoji(ctx, '❌', message);
};

/**
 * Sends a warning message prefixed with ⚠️ emoji.
 * Used for notifying users about potential issues or cautions.
 *
 * @param {ForwardContext} ctx - The context object to reply to
 * @param {string} message - The warning message to send
 * @returns {Promise<any>} Result of the reply operation
 */
export const replyWithWarning = async (ctx: ForwardContext, message: string) => {
    return replyWithEmoji(ctx, '⚠️', message);
};

/**
 * Sends a success message prefixed with ✅ emoji.
 * Used for confirming successful operations.
 *
 * @param {ForwardContext} ctx - The context object to reply to
 * @param {string} message - The success message to send
 * @returns {Promise<any>} Result of the reply operation
 */
export const replyWithSuccess = async (ctx: ForwardContext, message: string) => {
    return replyWithEmoji(ctx, '✅', message);
};

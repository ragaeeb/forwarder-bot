import type { ForwardContext } from '@/types.js';
import type { TelegramForumTopic, TelegramUser } from 'gramio';

import { config } from '@/config.js';
import logger from '@/utils/logger.js';
import { replyWithError, replyWithSuccess } from '@/utils/replyUtils.js';

const testPermissionsAndFinishSetup = async (ctx: ForwardContext, chatId: number) => {
    const testTopic = (await ctx.api.createForumTopic({
        chat_id: chatId,
        name: 'Test Topic Permissions',
    })) as TelegramForumTopic;

    await ctx.api.deleteForumTopic({
        chat_id: chatId,
        message_thread_id: testTopic.message_thread_id,
    });

    // Store group as the forwarding destination
    await ctx.db.saveConfig({
        adminGroupId: chatId.toString(),
        configId: 'main',
        setupAt: new Date().toISOString(),
        setupBy: ctx.update?.message?.from as TelegramUser,
    });

    return replyWithSuccess(
        ctx,
        `Setup complete! Group ${chatId.toString()} is now set as the contact inbox.\n\nIt is recommended that you delete the setup message for security purposes.`,
    );
};

export const onSetup = async (ctx: ForwardContext) => {
    // Extract token from command, e.g. /setup 123456:ABC-DEF1234
    const { args: providedToken } = ctx;

    if (providedToken === config.BOT_TOKEN) {
        if (ctx.chat?.type !== 'supergroup') {
            await ctx.reply('⚠️ This command must be used in a supergroup with topics enabled');
            return;
        }

        try {
            await testPermissionsAndFinishSetup(ctx, ctx.chat.id);
        } catch (error) {
            logger.error('Setup failed:', error);

            await replyWithError(
                ctx,
                'Setup failed. Please ensure topics are enabled and the bot has privileges to Manage Topics.',
            );
        }
    } else if (providedToken) {
        logger.warn(`Invalid token ${providedToken}`);
    }
};

import type { ForwardContext } from '@/types.js';
import type { TelegramForumTopic, TelegramUser } from 'gramio';

import { config } from '@/config.js';
import logger from '@/utils/logger.js';
import { replyWithError, replyWithSuccess } from '@/utils/replyUtils.js';

const testPermissionsAndFinishSetup = async (ctx: ForwardContext, chatId: number) => {
    logger.info(`create topic chatId=${chatId}`);
    console.log('ctx.bot.api', ctx.bot.api);
    console.log('ctx.api', ctx.api);
    const testTopic = (await ctx.bot.api.createForumTopic({
        chat_id: chatId,
        name: 'Test Topic Permissions',
    })) as TelegramForumTopic;

    logger.info(`delete topic ${JSON.stringify(testTopic)}`);
    await ctx.bot.api.deleteForumTopic({
        chat_id: chatId,
        message_thread_id: testTopic.message_thread_id,
    });

    logger.info(`save config`);
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
    logger.info(`onSetup`);

    // Extract token from command, e.g. /setup 123456:ABC-DEF1234
    const { args: providedToken } = ctx;

    if (providedToken === config.BOT_TOKEN) {
        if (ctx.chat?.type !== 'supergroup') {
            await ctx.reply('⚠️ This command must be used in a supergroup with topics enabled');
            return;
        }

        try {
            logger.info(`testing permissions`);
            await testPermissionsAndFinishSetup(ctx, ctx.chat.id);
        } catch (error) {
            logger.error(`Setup failed: ${JSON.stringify(error)}`);

            await replyWithError(
                ctx,
                'Setup failed. Please ensure topics are enabled and the bot has privileges to Manage Topics.',
            );
        }
    } else if (providedToken) {
        logger.warn(`Invalid token ${providedToken}`);
    }
};

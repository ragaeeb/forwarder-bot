import type { ForwardContext } from '@/types.js';
import type { TelegramForumTopic, TelegramUser } from 'gramio';

import { config } from '@/config.js';
import logger from '@/utils/logger.js';
import { replyWithError, replyWithSuccess, replyWithWarning } from '@/utils/replyUtils.js';

const testPermissionsAndFinishSetup = async (ctx: ForwardContext) => {
    const { id: chatId } = ctx.chat;

    logger.info(`Testing create thread for chat=${chatId}`);

    const testTopic = (await ctx.bot.api.createForumTopic({
        chat_id: chatId,
        name: 'Test Topic Permissions',
    })) as TelegramForumTopic;

    logger.info(testTopic, `Testing delete thread, and fetch existing config`);

    await ctx.bot.api.deleteForumTopic({
        chat_id: chatId,
        message_thread_id: testTopic.message_thread_id,
    });

    logger.info(`Saving config`);

    // Store group as the forwarding destination
    await ctx.db.saveConfig({
        adminGroupId: chatId.toString(),
        configId: 'main',
        setupAt: new Date().toISOString(),
        setupBy: ctx.update?.message?.from as TelegramUser,
    });

    logger.info(`Replying successful setup to user.`);

    return replyWithSuccess(
        ctx,
        `Setup complete! Group ${chatId.toString()} is now set as the contact inbox.\n\nIt is recommended that you delete the setup message for security purposes.`,
    );
};

const validatePreconfig = async (ctx: ForwardContext) => {
    const { id: chatId } = ctx.chat;
    const config = await ctx.db.getConfig();

    if (config) {
        logger.info(`Bot was already configured to chatId=${config.adminGroupId}`);

        if (config.adminGroupId === chatId.toString()) {
            logger.info(`We were already set up with ${chatId.toString()}`);
            return replyWithWarning(ctx, `Setup was already completed for this group.`);
        }

        try {
            // best effort
            logger.info(`Sending a notification to previous group of deactivation`);
            await replyWithWarning(ctx, `Bot is being reconfigured, deactivating forwards to this group.`);

            logger.info(`Leaving chat=${config.adminGroupId}`);
            await ctx.api.leaveChat({ chat_id: config.adminGroupId });

            logger.info(`Left old group`);
        } catch (err) {
            logger.error(err, `Failed to notify previous group of reconfiguration`);
        }
    }
};

export const onSetup = async (ctx: ForwardContext) => {
    logger.info(ctx.chat, `onSetup`);

    // Extract token from command, e.g. /setup 123456:ABC-DEF1234
    const { args: providedToken } = ctx;

    if (providedToken === config.BOT_TOKEN) {
        if (ctx.chat?.type !== 'supergroup') {
            logger.info(`Attempted to setup in ${ctx.chat?.type}`);
            await ctx.reply('⚠️ This command must be used in a supergroup with topics enabled');
            return;
        }

        try {
            const alreadyConfigured = await validatePreconfig(ctx);

            if (!alreadyConfigured) {
                await testPermissionsAndFinishSetup(ctx);
            }
        } catch (error) {
            logger.error(error, `Setup failed`);

            await replyWithError(
                ctx,
                'Setup failed. Please ensure topics are enabled and the bot has privileges to Manage Topics.',
            );
        }
    } else if (providedToken) {
        logger.warn(`Invalid token ${providedToken}`);

        await replyWithError(ctx, 'Invalid token provided.');
    } else {
        // don't send any reply for security purposes, we don't want them to know the structure of the setup
        logger.warn(`No token provided.`);
    }
};

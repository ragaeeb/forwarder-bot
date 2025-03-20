import type { ForwardContext } from '@/types.js';
import type { TelegramForumTopic, TelegramUser } from 'gramio';

import { config } from '@/config.js';
import logger from '@/utils/logger.js';
import { replyWithError, replyWithSuccess, replyWithWarning } from '@/utils/replyUtils.js';
import { hashToken } from '@/utils/security.js';

const validatePermissions = async (ctx: ForwardContext, chatId: number) => {
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
};

const executeSetup = async (ctx: ForwardContext, chatId: number) => {
    await validatePermissions(ctx, chatId);

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

const validatePreconfig = async (ctx: ForwardContext, chatId: number) => {
    const existingConfig = await ctx.db.getConfig();

    if (existingConfig) {
        logger.info(`Bot was already configured to chatId=${existingConfig.adminGroupId}`);

        if (existingConfig.adminGroupId === chatId.toString()) {
            logger.info(`We were already set up with ${chatId.toString()}`);
            return replyWithWarning(ctx, `Setup was already completed for this group.`);
        }

        try {
            // best effort
            logger.info(`Sending a notification to previous group of deactivation`);
            await replyWithWarning(ctx, `Bot is being reconfigured, deactivating forwards to this group.`);

            logger.info(`Leaving chat=${existingConfig.adminGroupId}`);
            await ctx.api.leaveChat({ chat_id: existingConfig.adminGroupId });

            logger.info(`Left old group`);
        } catch (err) {
            logger.error(err, `Failed to notify previous group of reconfiguration`);
        }
    }
};

export const onSetup = async (ctx: ForwardContext) => {
    logger.info(ctx.chat, `onSetup`);

    // Extract token from command, e.g. /setup abcd1341
    const { args: providedToken } = ctx;

    if (!providedToken) {
        // don't send any reply for security purposes, we don't want them to know the structure of the setup
        logger.warn(`No token provided.`);
        return;
    }

    if (providedToken !== hashToken(config.BOT_TOKEN)) {
        logger.warn(`Invalid token provided`);
        return;
    }

    try {
        const { id: chatId, type } = ctx.chat;

        if (type !== 'supergroup') {
            logger.info(`Attempted to setup in ${ctx.chat?.type}`);
            await replyWithWarning(ctx, 'This command must be used in a supergroup with topics enabled');
            return;
        }

        const chatMember = await ctx.bot.api.getChatMember({
            chat_id: chatId,
            user_id: ctx.from?.id as number,
        });

        if (!['administrator', 'creator'].includes(chatMember.status)) {
            logger.warn(`Unauthorized setup attempt by user ${ctx.from?.id}`);
            await replyWithWarning(ctx, 'Only group administrators can configure the bot');
            return;
        }

        const alreadyConfigured = await validatePreconfig(ctx, chatId);

        if (!alreadyConfigured) {
            await executeSetup(ctx, chatId);
        }
    } catch (error) {
        logger.error(error, `Setup failed`);

        await replyWithError(
            ctx,
            'Setup failed. Please ensure topics are enabled and the bot has privileges to Manage Topics.',
        );
    }
};

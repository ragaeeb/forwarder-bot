import type { ForwardContext } from '@/types.js';
import type { TelegramForumTopic } from 'gramio';

import { config } from '@/config.js';
import logger from '@/utils/logger.js';

const createAndDeleteTopic = async ({ api }: ForwardContext, chatId: number) => {
    const testTopic = (await api.createForumTopic({
        chat_id: chatId,
        name: 'Test Topic Permissions',
    })) as TelegramForumTopic;

    await api.deleteForumTopic({
        chat_id: chatId,
        message_thread_id: testTopic.message_thread_id,
    });
};

export const onSetup = async (ctx: ForwardContext) => {
    // Extract token from command, e.g. /setup 123456:ABC-DEF1234
    const {
        args: providedToken,
        chat: { id: chatId },
        db,
    } = ctx;

    if (!ctx.update?.message?.from) {
        await ctx.reply('⚠️ Unknown error');
        return;
    }

    if (providedToken === config.BOT_TOKEN) {
        if (ctx.chat?.type !== 'supergroup') {
            await ctx.reply('⚠️ This command must be used in a supergroup with topics enabled');
            return;
        }

        try {
            await createAndDeleteTopic(ctx, chatId);

            // Store group as the forwarding destination
            await db.saveConfig({
                adminGroupId: chatId.toString(),
                configId: 'main',
                setupAt: new Date().toISOString(),
                setupBy: ctx.update.message.from,
            });

            await ctx.reply(
                `✅ Setup complete! Group ${chatId.toString()} is now set as the contact inbox. It is recommended that you delete the setup message for security purposes.`,
            );
        } catch (error) {
            logger.error('Setup failed:', error);
            await ctx.reply(
                '❌ Setup failed. Please ensure topics are enabled and the bot has privileges to Manage Topics.',
            );
        }
    } else if (providedToken) {
        await ctx.reply('❌ Invalid token');
    } else {
        await ctx.reply('Usage: /setup YOUR_BOT_TOKEN');
    }
};

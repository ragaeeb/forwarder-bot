import type { ForwardContext } from '@/types.js';
import type { TelegramForumTopic } from 'gramio';

import { config } from '@/config.js';

export const onSetup = async (ctx: ForwardContext) => {
    // Extract token from command, e.g. /setup 123456:ABC-DEF1234
    const providedToken = ctx.args;

    if (providedToken === config.BOT_TOKEN) {
        if (ctx.chat?.type !== 'supergroup') {
            await ctx.reply('⚠️ This command must be used in a supergroup with topics enabled');
            return;
        }

        // Validate the group has topics enabled
        try {
            const testTopic = (await ctx.api?.createForumTopic({
                chat_id: ctx.chat.id,
                name: 'Test Topic - Verify',
            })) as TelegramForumTopic;

            await ctx.api?.deleteForumTopic({
                chat_id: ctx.chat.id,
                message_thread_id: testTopic.message_thread_id,
            });

            // Store group as the forwarding destination
            await ctx.db?.saveConfig({
                configId: 'main',
                contactGroupId: ctx.chat.id.toString(),
                setupAt: new Date().toISOString(),
            });

            // For security, delete the command message
            try {
                await ctx.api?.deleteMessage({
                    chat_id: ctx.chat.id,
                    message_id: ctx.update?.message?.message_id || 0,
                });
            } catch (err) {
                console.warn('Could not delete setup message:', err);
            }

            await ctx.reply('✅ Setup complete! This group is now set as the contact inbox.');
        } catch (error) {
            console.error('Setup failed:', error);
            await ctx.reply('❌ Setup failed. Please ensure topics are enabled and the bot has admin privileges.');
        }
    } else if (providedToken) {
        await ctx.reply('❌ Invalid token');
        // Delete message for security
        try {
            await ctx.api?.deleteMessage({
                chat_id: ctx.chat.id,
                message_id: ctx.update?.message?.message_id || 0,
            });
        } catch (e) {
            console.warn('Could not delete invalid setup message:', e);
        }
    } else {
        await ctx.reply('Usage: /setup YOUR_BOT_TOKEN');
    }
};

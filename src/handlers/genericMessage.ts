import { ForwardContext, Message } from '@/types.js';
import logger from '@/utils/logger.js';
import { TelegramMessage } from 'gramio';

const handleDirectMessage = async (ctx: ForwardContext, adminGroupId: string) => {
    if (!ctx.from || !ctx.update?.message || !ctx.api || !ctx.db) {
        return;
    }

    const userId = ctx.from.id.toString();
    const firstName = ctx.from.firstName;
    const username = ctx.from.username;
    const messageId = ctx.update.message.message_id;
    const chatId = ctx.chat.id;

    // Get or create thread for this user
    let threadData = await ctx.db.getThreadByUserId(userId);

    if (!threadData) {
        // Create a new topic in the group
        try {
            const response = await ctx.api.createForumTopic({
                chat_id: adminGroupId,
                name: `${userId}: ${username || firstName}`,
            });

            threadData = {
                chatId: chatId.toString(),
                createdAt: new Date().toISOString(),
                firstName,
                lastMessageId: messageId,
                threadId: response.message_thread_id.toString(),
                updatedAt: new Date().toISOString(),
                userId,
                username,
            };

            // Save the new thread data
            await ctx.db.saveThread(threadData);
        } catch (error) {
            console.error('Failed to create thread', { error, userId });
            await ctx.reply('❌ Failed to deliver your message. Please try again later.');
            return;
        }
    } else {
        // Update thread data
        threadData.lastMessageId = messageId;
        threadData.updatedAt = new Date().toISOString();

        // Update user info if available
        if (firstName && !threadData.firstName) {
            threadData.firstName = firstName;
        }

        if (username && !threadData.username) {
            threadData.username = username;
        }
    }

    // Save the message
    const message: Message = {
        caption: ctx.update.message.caption,
        chatId: chatId.toString(),
        mediaId: getMediaId(ctx.update.message),
        mediaType: getMediaType(ctx.update.message),
        messageId: messageId.toString(),
        text: ctx.update.message.text || '',
        timestamp: new Date().toISOString(),
        type: 'user',
        userId,
    };

    await ctx.db.saveMessage(message);

    // Forward the message to the group
    try {
        await ctx.api.forwardMessage({
            chat_id: adminGroupId,
            from_chat_id: chatId,
            message_id: messageId,
            message_thread_id: parseInt(threadData.threadId),
        });

        // Update the thread data
        await ctx.db.saveThread(threadData);

        // Confirm to the user
        await ctx.reply('✅ Message delivered, our team will get back to you soon.');
    } catch (error) {
        console.error('Failed to forward message', { error, userId });

        // Check if thread was deleted
        if (String(error).includes('message thread not found')) {
            try {
                // Create a new thread
                const response = await ctx.api.createForumTopic({
                    chat_id: adminGroupId,
                    name: `${userId}: ${username || firstName}`,
                });

                threadData.threadId = response.message_thread_id.toString();
                threadData.updatedAt = new Date().toISOString();

                // Try forwarding again
                await ctx.api.forwardMessage({
                    chat_id: adminGroupId,
                    from_chat_id: chatId,
                    message_id: messageId,
                    message_thread_id: response.message_thread_id,
                });

                // Save updated thread data
                await ctx.db.saveThread(threadData);

                // Confirm to the user
                await ctx.reply('✅ Message delivered, our team will get back to you soon.');
            } catch (retryError) {
                console.error('Failed to forward message after retry', { error: retryError, userId });
                await ctx.reply('❌ Failed to deliver your message. Please try again later.');
            }
        } else {
            await ctx.reply('❌ Failed to deliver your message. Please try again later.');
        }
    }
};

const handleGroupReply = async (ctx: ForwardContext) => {
    if (
        !ctx.update?.message ||
        !ctx.update.message.reply_to_message ||
        !ctx.update.message.message_thread_id ||
        !ctx.api ||
        !ctx.db
    ) {
        return;
    }

    const threadId = ctx.update.message.message_thread_id.toString();

    try {
        // Get thread data by thread ID
        const threadData = await ctx.db.getThreadByThreadId(threadId);

        if (!threadData) {
            console.warn('Thread data not found', { threadId });
            await ctx.reply('❌ Could not find the thread data for this user.');
            return;
        }

        const { chatId, userId } = threadData;

        if (!chatId) {
            console.warn('Chat ID not found in thread data', { threadData });
            await ctx.reply('❌ User chat information is incomplete.');
            return;
        }

        // Different handling based on message type
        let sentMessage;

        if (ctx.update.message.text) {
            sentMessage = await ctx.api.sendMessage({
                chat_id: chatId,
                text: ctx.update.message.text,
            });
        } else if (ctx.update.message.photo) {
            const photo = ctx.update.message.photo[ctx.update.message.photo.length - 1];
            sentMessage = await ctx.api.sendPhoto({
                caption: ctx.update.message.caption,
                chat_id: chatId,
                photo: photo.file_id,
            });
        } else if (ctx.update.message.document) {
            sentMessage = await ctx.api.sendDocument({
                caption: ctx.update.message.caption,
                chat_id: chatId,
                document: ctx.update.message.document.file_id,
            });
        } else {
            // Unsupported message type
            await ctx.reply('❌ Unsupported message type. Please send text, photo, or document.');
            return;
        }

        if (sentMessage) {
            // Save the admin's message
            const message: Message = {
                adminId: ctx.from?.id.toString(),
                adminName: ctx.from?.firstName,
                caption: ctx.update.message.caption,
                chatId,
                mediaId: getMediaId(ctx.update.message),
                mediaType: getMediaType(ctx.update.message),
                messageId: sentMessage.message_id.toString(),
                text: ctx.update.message.text || '',
                timestamp: new Date().toISOString(),
                type: 'admin',
                userId,
            };

            await ctx.db.saveMessage(message);

            // Update the thread data with the new message ID
            threadData.lastMessageId = sentMessage.message_id;
            threadData.updatedAt = new Date().toISOString();
            await ctx.db.saveThread(threadData);

            const userIdentifier = threadData.username || threadData.firstName || userId;
            await ctx.reply(`✅ Reply sent to user ${userIdentifier}`);
        }
    } catch (error) {
        console.error('Failed to reply to user', { error, threadId });
        await ctx.reply('❌ Failed to send your reply. Please try again.');
    }
};

// Helper functions for message media
const getMediaType = (message: TelegramMessage): string | undefined => {
    if (message.photo) return 'photo';
    if (message.document) return 'document';
    if (message.video) return 'video';
    if (message.voice) return 'voice';
    if (message.audio) return 'audio';
    if (message.sticker) return 'sticker';
    return undefined;
};

const getMediaId = (message: TelegramMessage): string | undefined => {
    if (message.photo && Array.isArray(message.photo) && message.photo.length > 0) {
        return message.photo[message.photo.length - 1].file_id;
    }
    if (message.document?.file_id) return message.document.file_id;
    if (message.video?.file_id) return message.video.file_id;
    if (message.voice?.file_id) return message.voice.file_id;
    if (message.audio?.file_id) return message.audio.file_id;
    if (message.sticker?.file_id) return message.sticker.file_id;
    return undefined;
};

export const onGenericMessage = async (ctx: ForwardContext) => {
    const { adminGroupId } = (await ctx.db.getConfig()) || {};

    if (!adminGroupId) {
        logger.warn(`Bot is not configured. Aborting.`);
        return;
    }

    if (!ctx.update?.message) {
        logger.warn(`No message found.`);
        return;
    }

    const { message } = ctx.update;

    if (ctx.chat.id.toString() === adminGroupId && message.reply_to_message && message.message_thread_id) {
        await handleGroupReply(ctx);
        return;
    }

    // Handle direct messages (if not from the contact group)
    if (adminGroupId && ctx.chat?.id.toString() !== adminGroupId) {
        await handleDirectMessage(ctx, adminGroupId);
    }
};

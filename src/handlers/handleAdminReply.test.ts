import type { ForwardContext } from '@/types/app.js';
import type { TelegramMessage } from '@/types/telegram.js';

import { mapTelegramMessageToSavedMessage } from '@/utils/messageUtils.js';
import { replyWithError, replyWithSuccess } from '@/utils/replyUtils.js';
import { updateThreadByMessage } from '@/utils/threadUtils.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { onAdminReply } from './handleAdminReply.js';

vi.mock('@/utils/messageUtils.js', () => ({
    mapTelegramMessageToSavedMessage: vi.fn().mockReturnValue({ id: '123', type: 'admin' }),
}));

vi.mock('@/utils/replyUtils.js');
vi.mock('@/utils/threadUtils.js');

describe('handleAdminReply', () => {
    let sentMessage: TelegramMessage;
    let ctx: ForwardContext;

    beforeEach(() => {
        vi.clearAllMocks();

        sentMessage = {
            message_id: 789,
            reply_to_message: 10,
            text: 'Hello user',
        } as unknown as TelegramMessage;

        ctx = {
            bot: {
                api: {},
            },
            chat: { id: 2 },
            db: {
                saveMessage: vi.fn().mockResolvedValue({}),
            },
            message: {
                reply_to_message: 10,
                text: 'Hello user',
            },
            thread: { userId: 1 },
        } as unknown as ForwardContext;
    });

    describe('onAdminReply', () => {
        it('should successfully forward text message to user', async () => {
            ctx.bot.api.sendMessage = vi.fn().mockResolvedValue(sentMessage);

            await onAdminReply(ctx as unknown as ForwardContext);

            expect(ctx.bot.api.sendMessage).toHaveBeenCalledExactlyOnceWith({
                chat_id: 1,
                protect_content: true,
                text: 'Hello user',
            });

            expect(ctx.db.saveMessage).toHaveBeenCalledExactlyOnceWith({ id: '123', type: 'admin' });
            expect(mapTelegramMessageToSavedMessage).toHaveBeenCalledExactlyOnceWith(sentMessage, 'admin');
            expect(updateThreadByMessage).toHaveBeenCalledExactlyOnceWith(ctx, ctx.thread, sentMessage);
            expect(replyWithSuccess).toHaveBeenCalledWith(ctx, 'Reply sent to user');
        });

        it('should successfully forward photo message to user', async () => {
            ctx.bot.api.sendPhoto = vi.fn().mockResolvedValue({
                message_id: 789,
            });
            ctx.message = {
                caption: 'Photo caption',
                message_thread_id: 123,
                photo: [
                    { file_id: 'small_id', height: 100, width: 100 },
                    { file_id: 'large_id', height: 800, width: 800 },
                ],
            } as TelegramMessage;

            await onAdminReply(ctx);

            expect(ctx.bot.api.sendPhoto).toHaveBeenCalledWith({
                caption: 'Photo caption',
                chat_id: 1,
                photo: 'large_id',
                protect_content: true,
            });

            expect(ctx.db.saveMessage).toHaveBeenCalledTimes(1);
            expect(mapTelegramMessageToSavedMessage).toHaveBeenCalledTimes(1);
            expect(updateThreadByMessage).toHaveBeenCalledTimes(1);
            expect(replyWithSuccess).toHaveBeenCalledWith(ctx, 'Reply sent to user');
        });

        it('should successfully forward document message to user', async () => {
            ctx.bot.api.sendDocument = vi.fn().mockResolvedValue({
                message_id: 789,
            });
            ctx.message = {
                caption: 'Document caption',
                document: {
                    file_id: 'doc_id',
                    file_name: 'document.pdf',
                },
                message_thread_id: 123,
            } as TelegramMessage;

            await onAdminReply(ctx);

            expect(ctx.bot.api.sendDocument).toHaveBeenCalledWith({
                caption: 'Document caption',
                chat_id: 1,
                document: 'doc_id',
                protect_content: true,
            });

            expect(replyWithSuccess).toHaveBeenCalledWith(ctx, 'Reply sent to user');
        });

        it('should successfully forward voice note to user', async () => {
            ctx.bot.api.sendVoice = vi.fn().mockResolvedValue({
                message_id: 789,
            });
            ctx.message = {
                caption: 'VN caption',
                message_thread_id: 123,
                voice: {
                    file_id: 'voice_id',
                },
            } as TelegramMessage;

            await onAdminReply(ctx);

            expect(ctx.bot.api.sendVoice).toHaveBeenCalledWith({
                caption: 'VN caption',
                chat_id: 1,
                protect_content: true,
                voice: 'voice_id',
            });

            expect(ctx.db.saveMessage).toHaveBeenCalledTimes(1);
            expect(mapTelegramMessageToSavedMessage).toHaveBeenCalledTimes(1);
            expect(updateThreadByMessage).toHaveBeenCalledTimes(1);
            expect(replyWithSuccess).toHaveBeenCalledWith(ctx, 'Reply sent to user');
        });

        it('should successfully forward video to user', async () => {
            ctx.bot.api.sendVideo = vi.fn().mockResolvedValue({
                message_id: 789,
            });
            ctx.message = {
                caption: 'Video caption',
                message_thread_id: 123,
                video: {
                    file_id: 'vid_id',
                },
            } as TelegramMessage;

            await onAdminReply(ctx);

            expect(ctx.bot.api.sendVideo).toHaveBeenCalledWith({
                caption: 'Video caption',
                chat_id: 1,
                protect_content: true,
                video: 'vid_id',
            });

            expect(replyWithSuccess).toHaveBeenCalledWith(ctx, 'Reply sent to user');
        });

        it('should return an error for unsupported message types', async () => {
            ctx.bot.api = {
                sendDocument: vi.fn(),
                sendMessage: vi.fn(),
                sendPhoto: vi.fn(),
            } as any;
            ctx.message = {
                // No text, photo or document - e.g. a location message
                location: {
                    latitude: 51.5074,
                    longitude: 0.1278,
                },
                message_thread_id: 123,
            } as unknown as TelegramMessage;

            await onAdminReply(ctx);

            expect(ctx.bot.api.sendMessage).not.toHaveBeenCalled();
            expect(ctx.bot.api.sendPhoto).not.toHaveBeenCalled();
            expect(ctx.bot.api.sendDocument).not.toHaveBeenCalled();

            expect(replyWithError).toHaveBeenCalledWith(ctx, expect.stringContaining('Unsupported message type'));
            expect(ctx.db.saveMessage).not.toHaveBeenCalled();
            expect(updateThreadByMessage).not.toHaveBeenCalled();
        });

        it('should handle errors', async () => {
            ctx.bot.api.sendMessage = vi.fn().mockRejectedValue(new Error('Could not send'));

            await onAdminReply(ctx as unknown as ForwardContext);

            expect(replyWithError).toHaveBeenCalledOnce();
        });
    });
});

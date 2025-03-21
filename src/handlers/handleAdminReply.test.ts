import { ForwardContext } from '@/types.js';
import { mapTelegramMessageToSavedMessage } from '@/utils/messageUtils.js';
import { replyWithError, replyWithSuccess } from '@/utils/replyUtils.js';
import { updateThreadByMessage } from '@/utils/threadUtils.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAdminReplyToCustomer } from './handleAdminReply.js';

vi.mock('@/utils/logger.js', () => ({
    default: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
}));

vi.mock('@/utils/messageUtils.js', () => ({
    mapTelegramMessageToSavedMessage: vi.fn().mockReturnValue({ id: '123', type: 'admin' }),
}));

vi.mock('@/utils/replyUtils.js', () => ({
    replyWithError: vi.fn().mockResolvedValue({}),
    replyWithSuccess: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/utils/threadUtils.js', () => ({
    updateThreadByMessage: vi.fn().mockResolvedValue({}),
}));

describe('handleAdminReply', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handleAdminReplyToCustomer', () => {
        it('should return an error if thread data is not found', async () => {
            const ctx = {
                db: {
                    getThreadById: vi.fn().mockResolvedValue(null),
                },
                update: {
                    message: {
                        message_thread_id: 123,
                    },
                },
            } as unknown as ForwardContext;

            const result = await handleAdminReplyToCustomer(ctx);

            expect(ctx.db.getThreadById).toHaveBeenCalledWith('123');
            expect(replyWithError).toHaveBeenCalledWith(ctx, 'Could not find the thread data for this user.');
            expect(result).toBeDefined();
        });

        it('should successfully forward text message to user', async () => {
            const ctx = {
                bot: {
                    api: {
                        sendMessage: vi.fn().mockResolvedValue({
                            message_id: 789,
                        }),
                    },
                },
                db: {
                    getThreadById: vi.fn().mockResolvedValue({
                        chatId: '456',
                        threadId: 123,
                    }),
                    saveMessage: vi.fn().mockResolvedValue({}),
                },
                update: {
                    message: {
                        message_thread_id: 123,
                        text: 'Hello user',
                    },
                },
            } as unknown as ForwardContext;

            const result = await handleAdminReplyToCustomer(ctx);

            expect(ctx.bot.api.sendMessage).toHaveBeenCalledWith({
                chat_id: '456',
                protect_content: true,
                text: 'Hello user',
            });

            expect(ctx.db.saveMessage).toHaveBeenCalledTimes(1);
            expect(mapTelegramMessageToSavedMessage).toHaveBeenCalledTimes(1);
            expect(updateThreadByMessage).toHaveBeenCalledTimes(1);
            expect(replyWithSuccess).toHaveBeenCalledWith(ctx, 'Reply sent to user');
            expect(result).toBeDefined();
        });

        it('should successfully forward photo message to user', async () => {
            const ctx = {
                bot: {
                    api: {
                        sendPhoto: vi.fn().mockResolvedValue({
                            message_id: 789,
                        }),
                    },
                },
                db: {
                    getThreadById: vi.fn().mockResolvedValue({
                        chatId: '456',
                        threadId: 123,
                    }),
                    saveMessage: vi.fn().mockResolvedValue({}),
                },
                update: {
                    message: {
                        caption: 'Photo caption',
                        message_thread_id: 123,
                        photo: [
                            { file_id: 'small_id', height: 100, width: 100 },
                            { file_id: 'large_id', height: 800, width: 800 },
                        ],
                    },
                },
            } as unknown as ForwardContext;

            const result = await handleAdminReplyToCustomer(ctx);

            expect(ctx.bot.api.sendPhoto).toHaveBeenCalledWith({
                caption: 'Photo caption',
                chat_id: '456',
                photo: 'large_id',
                protect_content: true,
            });

            expect(ctx.db.saveMessage).toHaveBeenCalledTimes(1);
            expect(mapTelegramMessageToSavedMessage).toHaveBeenCalledTimes(1);
            expect(updateThreadByMessage).toHaveBeenCalledTimes(1);
            expect(replyWithSuccess).toHaveBeenCalledWith(ctx, 'Reply sent to user');
            expect(result).toBeDefined();
        });

        it('should successfully forward document message to user', async () => {
            const ctx = {
                bot: {
                    api: {
                        sendDocument: vi.fn().mockResolvedValue({
                            message_id: 789,
                        }),
                    },
                },
                db: {
                    getThreadById: vi.fn().mockResolvedValue({
                        chatId: '456',
                        threadId: 123,
                    }),
                    saveMessage: vi.fn().mockResolvedValue({}),
                },
                update: {
                    message: {
                        caption: 'Document caption',
                        document: {
                            file_id: 'doc_id',
                            file_name: 'document.pdf',
                        },
                        message_thread_id: 123,
                    },
                },
            } as unknown as ForwardContext;

            const result = await handleAdminReplyToCustomer(ctx);

            expect(ctx.bot.api.sendDocument).toHaveBeenCalledWith({
                caption: 'Document caption',
                chat_id: '456',
                document: 'doc_id',
                protect_content: true,
            });

            expect(ctx.db.saveMessage).toHaveBeenCalledTimes(1);
            expect(mapTelegramMessageToSavedMessage).toHaveBeenCalledTimes(1);
            expect(updateThreadByMessage).toHaveBeenCalledTimes(1);
            expect(replyWithSuccess).toHaveBeenCalledWith(ctx, 'Reply sent to user');
            expect(result).toBeDefined();
        });

        it('should successfully forward voice note to user', async () => {
            const ctx = {
                bot: {
                    api: {
                        sendVoice: vi.fn().mockResolvedValue({
                            message_id: 789,
                        }),
                    },
                },
                db: {
                    getThreadById: vi.fn().mockResolvedValue({
                        chatId: '456',
                        threadId: 123,
                    }),
                    saveMessage: vi.fn().mockResolvedValue({}),
                },
                update: {
                    message: {
                        caption: 'VN caption',
                        message_thread_id: 123,
                        voice: {
                            file_id: 'voice_id',
                        },
                    },
                },
            } as unknown as ForwardContext;

            const result = await handleAdminReplyToCustomer(ctx);

            expect(ctx.bot.api.sendVoice).toHaveBeenCalledWith({
                caption: 'VN caption',
                chat_id: '456',
                protect_content: true,
                voice: 'voice_id',
            });

            expect(ctx.db.saveMessage).toHaveBeenCalledTimes(1);
            expect(mapTelegramMessageToSavedMessage).toHaveBeenCalledTimes(1);
            expect(updateThreadByMessage).toHaveBeenCalledTimes(1);
            expect(replyWithSuccess).toHaveBeenCalledWith(ctx, 'Reply sent to user');
            expect(result).toBeDefined();
        });

        it('should successfully forward video to user', async () => {
            const ctx = {
                bot: {
                    api: {
                        sendVideo: vi.fn().mockResolvedValue({
                            message_id: 789,
                        }),
                    },
                },
                db: {
                    getThreadById: vi.fn().mockResolvedValue({
                        chatId: '456',
                        threadId: 123,
                    }),
                    saveMessage: vi.fn().mockResolvedValue({}),
                },
                update: {
                    message: {
                        caption: 'Video caption',
                        message_thread_id: 123,
                        video: {
                            file_id: 'vid_id',
                        },
                    },
                },
            } as unknown as ForwardContext;

            const result = await handleAdminReplyToCustomer(ctx);

            expect(ctx.bot.api.sendVideo).toHaveBeenCalledWith({
                caption: 'Video caption',
                chat_id: '456',
                protect_content: true,
                video: 'vid_id',
            });

            expect(ctx.db.saveMessage).toHaveBeenCalledTimes(1);
            expect(mapTelegramMessageToSavedMessage).toHaveBeenCalledTimes(1);
            expect(updateThreadByMessage).toHaveBeenCalledTimes(1);
            expect(replyWithSuccess).toHaveBeenCalledWith(ctx, 'Reply sent to user');
            expect(result).toBeDefined();
        });

        it('should return an error for unsupported message types', async () => {
            const ctx = {
                bot: {
                    api: {
                        sendDocument: vi.fn(),
                        sendMessage: vi.fn(),
                        sendPhoto: vi.fn(),
                    },
                },
                db: {
                    getThreadById: vi.fn().mockResolvedValue({
                        chatId: '456',
                        threadId: 123,
                    }),
                    saveMessage: vi.fn().mockResolvedValue({}),
                },
                update: {
                    message: {
                        // No text, photo or document - e.g. a location message
                        location: {
                            latitude: 51.5074,
                            longitude: 0.1278,
                        },
                        message_thread_id: 123,
                    },
                },
            } as unknown as ForwardContext;

            const result = await handleAdminReplyToCustomer(ctx);

            expect(ctx.bot.api.sendMessage).not.toHaveBeenCalled();
            expect(ctx.bot.api.sendPhoto).not.toHaveBeenCalled();
            expect(ctx.bot.api.sendDocument).not.toHaveBeenCalled();

            expect(replyWithError).toHaveBeenCalledWith(
                ctx,
                'Unsupported message type. Please send text, photo, or document.',
            );
            expect(ctx.db.saveMessage).not.toHaveBeenCalled();
            expect(updateThreadByMessage).not.toHaveBeenCalled();
            expect(result).toBeDefined();
        });
    });
});

import type { ForwardContext } from '@/types.js';

import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';

import { handleEditedMessage } from './handleEditedMessage.js';

vi.mock('@/utils/logger.js', () => ({
    default: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
}));

vi.mock('@/utils/messageUtils.js', () => ({
    mapTelegramMessageToSavedMessage: vi.fn((message, type) => ({
        chatId: '123',
        from: {
            firstName: message.from?.first_name,
            lastName: message.from?.last_name,
            userId: message.from?.id.toString(),
            username: message.from?.username,
        },
        text: message.text || '',
        timestamp: new Date().toISOString(),
        type,
    })),
}));

describe('handleEditedMessage', () => {
    let mockCtx: ForwardContext;
    const now = new Date();

    beforeEach(() => {
        vi.resetAllMocks();

        mockCtx = {
            bot: {
                api: {
                    forwardMessage: vi.fn().mockResolvedValue({}),
                    sendMessage: vi.fn().mockResolvedValue({}),
                },
            },
            chat: {
                id: 123,
                type: 'private',
            },
            chatId: '123',
            db: {
                getThreadByUserId: vi.fn(),
                saveMessage: vi.fn(),
            },
            from: {
                first_name: 'Test',
                id: 456,
                is_bot: false,
            },
            settings: { adminGroupId: '789' },
            update: {
                edited_message: {
                    chat: {
                        id: 123,
                        type: 'private',
                    },
                    from: {
                        first_name: 'Test',
                        id: 456,
                        is_bot: false,
                    },
                    message_id: 789,
                    text: 'Edited message',
                },
            },
        } as unknown as ForwardContext;

        vi.spyOn(Date, 'now').mockImplementation(() => now.getTime());
    });

    describe('handleEditedMessage', () => {
        it('should skip processing for non-private chats', async () => {
            Object.assign(mockCtx.chat, { type: 'group' });

            await handleEditedMessage(mockCtx);

            expect(mockCtx.db.getThreadByUserId).not.toHaveBeenCalled();
            expect(mockCtx.bot.api.sendMessage).not.toHaveBeenCalled();
            expect(mockCtx.bot.api.forwardMessage).not.toHaveBeenCalled();
            expect(mockCtx.db.saveMessage).not.toHaveBeenCalled();
        });

        it('should abort if thread for user is not found', async () => {
            (mockCtx.db.getThreadByUserId as Mock).mockResolvedValue(null);

            await handleEditedMessage(mockCtx);

            expect(mockCtx.db.getThreadByUserId).toHaveBeenCalledWith('456');
            expect(mockCtx.bot.api.sendMessage).not.toHaveBeenCalled();
            expect(mockCtx.bot.api.forwardMessage).not.toHaveBeenCalled();
            expect(mockCtx.db.saveMessage).not.toHaveBeenCalled();
        });

        it('should process edited message correctly when all conditions are met', async () => {
            const threadData = {
                chatId: '123',
                createdAt: '2023-01-01T00:00:00Z',
                lastMessageId: '788',
                name: 'Test User',
                threadId: '1001',
                updatedAt: '2023-01-01T00:00:00Z',
                userId: '456',
            };

            const savedMessage = {
                chatId: '123',
                from: {
                    firstName: 'Test',
                    userId: '456',
                },
                id: `789_edited_${now.getTime()}`,
                originalMessageId: '789',
                text: 'Edited message',
                timestamp: expect.any(String),
                type: 'user',
            };

            (mockCtx.db.getThreadByUserId as Mock).mockResolvedValue(threadData);
            (mockCtx.db.saveMessage as Mock).mockResolvedValue({ ...savedMessage, id: savedMessage.id });

            await handleEditedMessage(mockCtx);

            expect(mockCtx.db.getThreadByUserId).toHaveBeenCalledWith('456');

            expect(mockCtx.bot.api.sendMessage).toHaveBeenCalledWith({
                chat_id: '789',
                message_thread_id: 1001,
                text: '🔄 Message Edit Notification',
            });

            expect(mockCtx.bot.api.forwardMessage).toHaveBeenCalledWith({
                chat_id: '789',
                from_chat_id: '123',
                message_id: 789,
                message_thread_id: 1001,
            });

            expect(mockCtx.db.saveMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: `789_edited_${now.getTime()}`,
                    originalMessageId: '789',
                }),
            );
        });

        it('should handle errors gracefully', async () => {
            const error = new Error('Test error');
            (mockCtx.db.getThreadByUserId as Mock).mockRejectedValue(error);

            await handleEditedMessage(mockCtx);

            expect(mockCtx.db.getThreadByUserId).toHaveBeenCalled();
        });

        it('should use parseInt to convert threadId from string to number', async () => {
            const threadData = {
                chatId: '123',
                createdAt: '2023-01-01T00:00:00Z',
                lastMessageId: '788',
                name: 'Test User',
                threadId: '1001',
                updatedAt: '2023-01-01T00:00:00Z',
                userId: '456',
            };

            (mockCtx.db.getThreadByUserId as Mock).mockResolvedValue(threadData);

            await handleEditedMessage(mockCtx);

            expect(mockCtx.bot.api.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    message_thread_id: 1001,
                }),
            );

            expect(mockCtx.bot.api.forwardMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    message_thread_id: 1001,
                }),
            );
        });
    });
});

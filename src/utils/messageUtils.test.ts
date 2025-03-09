import type { TelegramMessage } from 'gramio';

import { describe, expect, it } from 'vitest';

import { mapTelegramMessageToSavedMessage } from './messageUtils.js';

describe('messageUtils', () => {
    describe('mapTelegramMessageToSavedMessage', () => {
        it('should map a basic text message correctly', () => {
            const message: TelegramMessage = {
                chat: { id: 67890, type: 'private' },
                date: 1645564800, // 2022-02-23T00:00:00.000Z
                from: {
                    first_name: 'John',
                    id: 98765,
                    is_bot: false,
                    last_name: 'Doe',
                    username: 'johndoe',
                },
                message_id: 12345,
                text: 'Hello, world!',
            };

            const result = mapTelegramMessageToSavedMessage(message, 'user');

            expect(result).toEqual({
                chatId: '67890',
                from: {
                    firstName: 'John',
                    lastName: 'Doe',
                    userId: '98765',
                    username: 'johndoe',
                },
                id: '12345',
                text: 'Hello, world!',
                timestamp: expect.any(String),
                type: 'user',
            });

            expect(new Date(result.timestamp)).toEqual(new Date(message.date * 1000));
        });

        it('should map an admin message correctly', () => {
            const message: TelegramMessage = {
                chat: { id: 67890, type: 'private' },
                date: 1645564800,
                from: {
                    first_name: 'Admin',
                    id: 98765,
                    is_bot: false,
                    username: 'adminuser',
                },
                message_id: 12345,
                text: 'Admin announcement',
            };

            const result = mapTelegramMessageToSavedMessage(message, 'admin');

            expect(result).toEqual({
                chatId: '67890',
                from: {
                    firstName: 'Admin',
                    userId: '98765',
                    username: 'adminuser',
                },
                id: '12345',
                text: 'Admin announcement',
                timestamp: expect.any(String),
                type: 'admin',
            });

            expect(new Date(result.timestamp)).toEqual(new Date(message.date * 1000));
        });

        it('should handle empty text message', () => {
            const message: TelegramMessage = {
                chat: { id: 67890, type: 'private' },
                date: 1645564800,
                from: {
                    first_name: 'John',
                    id: 98765,
                    is_bot: false,
                },
                message_id: 12345,
                // No text field
            };

            const result = mapTelegramMessageToSavedMessage(message, 'user');

            expect(result.text).toBe('');
        });

        it('should handle message with photo', () => {
            const message: TelegramMessage = {
                caption: 'Look at this photo',
                chat: { id: 67890, type: 'private' },
                date: 1645564800,
                from: {
                    first_name: 'John',
                    id: 98765,
                    is_bot: false,
                },
                message_id: 12345,
                photo: [
                    { file_id: 'small_photo_id', file_size: 1024, file_unique_id: 'small', height: 100, width: 100 },
                    { file_id: 'medium_photo_id', file_size: 10240, file_unique_id: 'medium', height: 320, width: 320 },
                    { file_id: 'large_photo_id', file_size: 51200, file_unique_id: 'large', height: 800, width: 800 },
                ],
            };

            const result = mapTelegramMessageToSavedMessage(message, 'user');

            expect(result.mediaType).toBe('photo');
            expect(result.mediaId).toBe('large_photo_id'); // Should select the last (largest) photo
            expect(result.caption).toBe('Look at this photo');
        });

        it('should handle message with document', () => {
            const message: TelegramMessage = {
                caption: 'Here is the document',
                chat: { id: 67890, type: 'private' },
                date: 1645564800,
                document: {
                    file_id: 'doc_file_id',
                    file_name: 'document.pdf',
                    file_unique_id: 'doc',
                    mime_type: 'application/pdf',
                },
                from: {
                    first_name: 'John',
                    id: 98765,
                    is_bot: false,
                },
                message_id: 12345,
            };

            const result = mapTelegramMessageToSavedMessage(message, 'user');

            expect(result.mediaType).toBe('document');
            expect(result.mediaId).toBe('doc_file_id');
            expect(result.caption).toBe('Here is the document');
        });

        it('should handle message with video', () => {
            const message: TelegramMessage = {
                caption: 'Check out this video',
                chat: { id: 67890, type: 'private' },
                date: 1645564800,
                from: {
                    first_name: 'John',
                    id: 98765,
                    is_bot: false,
                },
                message_id: 12345,
                video: {
                    duration: 30,
                    file_id: 'video_file_id',
                    file_unique_id: 'video',
                    height: 720,
                    width: 1280,
                },
            };

            const result = mapTelegramMessageToSavedMessage(message, 'user');

            expect(result.mediaType).toBe('video');
            expect(result.mediaId).toBe('video_file_id');
            expect(result.caption).toBe('Check out this video');
        });

        it('should handle message with voice', () => {
            const message: TelegramMessage = {
                chat: { id: 67890, type: 'private' },
                date: 1645564800,
                from: {
                    first_name: 'John',
                    id: 98765,
                    is_bot: false,
                },
                message_id: 12345,
                voice: {
                    duration: 15,
                    file_id: 'voice_file_id',
                    file_unique_id: 'voice',
                    mime_type: 'audio/ogg',
                },
            };

            const result = mapTelegramMessageToSavedMessage(message, 'user');

            expect(result.mediaType).toBe('voice');
            expect(result.mediaId).toBe('voice_file_id');
        });

        it('should handle message with audio', () => {
            const message: TelegramMessage = {
                audio: {
                    duration: 240,
                    file_id: 'audio_file_id',
                    file_unique_id: 'audio',
                    performer: 'Artist Name',
                    title: 'Song Title',
                },
                chat: { id: 67890, type: 'private' },
                date: 1645564800,
                from: {
                    first_name: 'John',
                    id: 98765,
                    is_bot: false,
                },
                message_id: 12345,
            };

            const result = mapTelegramMessageToSavedMessage(message, 'user');

            expect(result.mediaType).toBe('audio');
            expect(result.mediaId).toBe('audio_file_id');
        });

        it('should handle message with sticker', () => {
            const message: TelegramMessage = {
                chat: { id: 67890, type: 'private' },
                date: 1645564800,
                from: {
                    first_name: 'John',
                    id: 98765,
                    is_bot: false,
                },
                message_id: 12345,
                sticker: {
                    emoji: '😊',
                    file_id: 'sticker_file_id',
                    file_unique_id: 'sticker',
                    height: 512,
                    is_animated: false,
                    is_video: false,
                    set_name: 'StickerSetName',
                    type: 'regular',
                    width: 512,
                },
            };

            const result = mapTelegramMessageToSavedMessage(message, 'user');

            expect(result.mediaType).toBe('sticker');
            expect(result.mediaId).toBe('sticker_file_id');
        });

        it('should handle message with reply', () => {
            const message: TelegramMessage = {
                chat: { id: 67890, type: 'private' },
                date: 1645564800,
                from: {
                    first_name: 'John',
                    id: 98765,
                    is_bot: false,
                },
                message_id: 12345,
                reply_to_message: {
                    chat: { id: 67890, type: 'private' },
                    date: 1645564700,
                    from: {
                        first_name: 'Jane',
                        id: 11111,
                        is_bot: false,
                    },
                    message_id: 12340,
                    text: 'Original message',
                },
                text: 'This is a reply',
            };

            const result = mapTelegramMessageToSavedMessage(message, 'user');

            expect(result.replyToMessageId).toBe('12340');
        });

        it('should handle message with quote', () => {
            const message: TelegramMessage = {
                chat: { id: 67890, type: 'private' },
                date: 1645564800,
                from: {
                    first_name: 'John',
                    id: 98765,
                    is_bot: false,
                },
                message_id: 12345,
                quote: {
                    entities: [],
                    position: 10,
                    text: 'This is the quoted text',
                },
                text: 'This is a quote reply',
            };

            const result = mapTelegramMessageToSavedMessage(message, 'user');

            expect(result.quote).toBe('This is the quoted text');
        });

        it('should handle forwarded message', () => {
            const message: TelegramMessage = {
                chat: { id: 67890, type: 'private' },
                date: 1645564800,
                forward_origin: {
                    date: 1645564600,
                    sender_user: {
                        first_name: 'Original',
                        id: 11111,
                        is_bot: false,
                        last_name: 'Sender',
                    },
                    type: 'user',
                },
                from: {
                    first_name: 'John',
                    id: 98765,
                    is_bot: false,
                },
                message_id: 12345,
                text: 'Forwarded message content',
            };

            const result = mapTelegramMessageToSavedMessage(message, 'user');

            expect(result.forwardOrigin).toEqual({
                date: 1645564600,
                sender_user: {
                    first_name: 'Original',
                    id: 11111,
                    is_bot: false,
                    last_name: 'Sender',
                },
                type: 'user',
            });
        });
    });
});

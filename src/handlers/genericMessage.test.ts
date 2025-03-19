import { ForwardContext } from '@/types.js';
import logger from '@/utils/logger.js';
import { replyWithUnknownError } from '@/utils/replyUtils.js';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';

import { onGenericMessage } from './genericMessage.js';
import { handleAdminReplyToCustomer } from './handleAdminReply.js';
import { handleDirectMessage } from './handleDirectMessage.js';

vi.mock('@/utils/logger.js', () => ({
    default: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
}));

vi.mock('@/utils/replyUtils.js', () => ({
    replyWithUnknownError: vi.fn(),
}));

vi.mock('./handleAdminReply', () => ({
    handleAdminReplyToCustomer: vi.fn(),
}));

vi.mock('./handleDirectMessage', () => ({
    handleDirectMessage: vi.fn(),
}));

describe('genericMessage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('onGenericMessage', () => {
        it('should abort if the setup phase was not completed', async () => {
            const ctx = { db: { getConfig: vi.fn().mockResolvedValue({}) } };

            await onGenericMessage(ctx as unknown as ForwardContext);

            expect(handleAdminReplyToCustomer).not.toHaveBeenCalled();
            expect(handleDirectMessage).not.toHaveBeenCalled();
        });

        it('should ignore non-message calls', async () => {
            const ctx = { db: { getConfig: vi.fn().mockResolvedValue({ adminGroupId: 1 }) } };

            await onGenericMessage(ctx as unknown as ForwardContext);

            expect(logger.warn).toHaveBeenCalledOnce();
        });

        it('should handle when an admin replies to a message in the group but it results in an error', async () => {
            const ctx = {
                chat: { id: 1, type: 'supergroup' },
                db: { getConfig: vi.fn().mockResolvedValue({ adminGroupId: '1' }) },
                update: { message: { message_thread_id: 1, reply_to_message: {} } },
            };

            await onGenericMessage(ctx as unknown as ForwardContext);

            expect(handleAdminReplyToCustomer).toHaveBeenCalledOnce();
            expect(handleAdminReplyToCustomer).toHaveBeenCalledWith(ctx);
            expect(replyWithUnknownError).toHaveBeenCalledOnce();
            expect(replyWithUnknownError).toHaveBeenCalledWith(ctx);
        });

        it('should handle DMs that result in an error', async () => {
            const ctx = {
                chat: { id: 1, type: 'private' },
                db: { getConfig: vi.fn().mockResolvedValue({ adminGroupId: '2' }) },
                update: { message: { message_thread_id: 1, reply_to_message: {} } },
            };

            await onGenericMessage(ctx as unknown as ForwardContext);

            expect(handleAdminReplyToCustomer).not.toHaveBeenCalled();
            expect(replyWithUnknownError).toHaveBeenCalledOnce();
            expect(replyWithUnknownError).toHaveBeenCalledWith(ctx);
        });

        it('should handle DMs that are successful', async () => {
            const ctx = {
                chat: { id: 1, type: 'private' },
                db: { getConfig: vi.fn().mockResolvedValue({ adminGroupId: '2' }) },
                update: { message: { message_thread_id: 1, reply_to_message: {} } },
            };

            (handleDirectMessage as Mock).mockResolvedValue(true);

            await onGenericMessage(ctx as unknown as ForwardContext);

            expect(handleAdminReplyToCustomer).not.toHaveBeenCalled();
            expect(replyWithUnknownError).not.toHaveBeenCalled();
        });

        it('should handle when an admin replies to a message in the group and it is successful', async () => {
            const ctx = {
                chat: { id: 1, type: 'supergroup' },
                db: { getConfig: vi.fn().mockResolvedValue({ adminGroupId: '1' }) },
                update: { message: { message_thread_id: 1, reply_to_message: {} } },
            };

            (handleAdminReplyToCustomer as Mock).mockResolvedValue(true);

            await onGenericMessage(ctx as unknown as ForwardContext);

            expect(handleAdminReplyToCustomer).toHaveBeenCalledOnce();
            expect(handleAdminReplyToCustomer).toHaveBeenCalledWith(ctx);
            expect(replyWithUnknownError).not.toHaveBeenCalled();
        });

        it('should skip messages that do not match the group in the config', async () => {
            const ctx = {
                chat: { id: 2, type: 'supergroup' },
                db: { getConfig: vi.fn().mockResolvedValue({ adminGroupId: '1' }) },
                update: { message: { message_thread_id: 1, reply_to_message: {} } },
            };

            await onGenericMessage(ctx as unknown as ForwardContext);

            expect(handleAdminReplyToCustomer).not.toHaveBeenCalled();
            expect(handleDirectMessage).not.toHaveBeenCalled();
        });

        it('should skip messages that are not part of a supergroup', async () => {
            const ctx = {
                chat: { id: 2, type: 'group' },
                db: { getConfig: vi.fn().mockResolvedValue({ adminGroupId: '1' }) },
                update: { message: { message_thread_id: 1, reply_to_message: {} } },
            };

            await onGenericMessage(ctx as unknown as ForwardContext);

            expect(handleAdminReplyToCustomer).not.toHaveBeenCalled();
            expect(handleDirectMessage).not.toHaveBeenCalled();
            expect(replyWithUnknownError).not.toHaveBeenCalled();
        });
    });
});

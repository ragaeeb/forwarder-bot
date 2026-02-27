import type { NextFunction } from '@/bot.js';
import type { ForwardContext } from '@/types/app.js';

import { replyWithError } from '@/utils/replyUtils.js';
import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { requireManageTopicsPermission } from './requireManageTopicsPermission.js';

mock.module('@/utils/replyUtils.js');

describe('requireManageTopicsPermission', () => {
    let next: NextFunction;

    beforeEach(() => {
        mock.restore();
        next = mock(() => {});
    });

    it('should fail if bot could not create topic', async () => {
        const ctx = {
            bot: {
                api: {
                    createForumTopic: mock(() => {}).mockRejectedValue(new Error('Cannot create thread'))}},
            chat: {
                id: 1}};

        await requireManageTopicsPermission(ctx as unknown as ForwardContext, next);

        expect(next).not.toHaveBeenCalled();
        expect(replyWithError).toHaveBeenCalledOnce();
        expect(ctx.bot.api.createForumTopic).toHaveBeenCalledExactlyOnceWith({
            chat_id: 1,
            name: expect.any(String)});
    });

    it('should fail if bot could not delete topic', async () => {
        const ctx = {
            bot: {
                api: {
                    createForumTopic: mock(() => {}).mockResolvedValue({ message_thread_id: 99, name: 'T' }),
                    deleteForumTopic: mock(() => {}).mockRejectedValue(new Error('Cannot create thread'))}},
            chat: {
                id: 1}};

        await requireManageTopicsPermission(ctx as unknown as ForwardContext, next);

        expect(next).not.toHaveBeenCalled();
        expect(replyWithError).toHaveBeenCalledOnce();
        expect(ctx.bot.api.deleteForumTopic).toHaveBeenCalledExactlyOnceWith({
            chat_id: 1,
            message_thread_id: 99});
    });

    it('should pass if we were able to create and delete the forum topic', async () => {
        const ctx = {
            bot: {
                api: {
                    createForumTopic: mock(() => {}).mockResolvedValue({ message_thread_id: 99, name: 'T' }),
                    deleteForumTopic: mock(() => {}).mockResolvedValue(true)}},
            chat: {
                id: 1}};

        await requireManageTopicsPermission(ctx as unknown as ForwardContext, next);

        expect(next).toHaveBeenCalledExactlyOnceWith();
        expect(replyWithError).not.toHaveBeenCalled();
    });
});

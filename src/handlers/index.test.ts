import type { Bot } from '@/bot.js';
import type { DataService } from '@/services/types.js';

import { onCustomize } from '@/commands/customize.js';
import { onSetup } from '@/commands/setup.js';
import { onStart } from '@/commands/start.js';
import { injectDependencies, requireAdminReply, requirePrivateChat, requireSetup } from '@/middlewares/common.js';
import { requireGroupAdmin } from '@/middlewares/requireGroupAdmin.js';
import { requireManageTopicsPermission } from '@/middlewares/requireManageTopicsPermission.js';
import { requireReferencedThread, requireThreadForUser } from '@/middlewares/requireMessageThread.js';
import { requireNewSetup } from '@/middlewares/requireNewSetup.js';
import { requireToken } from '@/middlewares/requireToken.js';
import { describe, expect, it, vi } from 'vitest';

import { onAdminReply } from './handleAdminReply.js';
import { onDirectMessage } from './handleDirectMessage.js';
import { onEditedMessage } from './handleEditedMessage.js';
import { registerHandlers } from './index.js';

vi.mock('@/commands/customize.js', () => ({
    CUSTOMIZE_COMMANDS: ['ack', 'failure'],
    onCustomize: vi.fn(),
}));

vi.mock('@/middlewares/common.js');

describe('registerHandlers', () => {
    it('should register only setup handler when bot is not configured', async () => {
        const bot = {
            command: vi.fn(),
            on: vi.fn(),
            use: vi.fn(),
        };

        const db = {};

        registerHandlers(bot as unknown as Bot, db as unknown as DataService);

        expect(bot.use).toHaveBeenCalledTimes(1);
        expect(injectDependencies).toHaveBeenCalledExactlyOnceWith(db);

        expect(bot.command).toHaveBeenCalledTimes(4);
        expect(bot.command).toHaveBeenNthCalledWith(
            1,
            'setup',
            requireToken,
            requireGroupAdmin,
            requireNewSetup,
            requireManageTopicsPermission,
            onSetup,
        );

        expect(bot.command).toHaveBeenNthCalledWith(2, 'start', requireSetup, onStart);
        expect(bot.command).toHaveBeenNthCalledWith(3, 'ack', requireSetup, requireGroupAdmin, onCustomize);
        expect(bot.command).toHaveBeenNthCalledWith(4, 'failure', requireSetup, requireGroupAdmin, onCustomize);

        expect(bot.on).toHaveBeenCalledTimes(3);
        expect(bot.on).toHaveBeenNthCalledWith(
            1,
            'message',
            requireSetup,
            requireAdminReply,
            requireReferencedThread,
            onAdminReply,
        );
        expect(bot.on).toHaveBeenNthCalledWith(
            2,
            'message',
            requireSetup,
            requirePrivateChat,
            requireThreadForUser,
            onDirectMessage,
        );
        expect(bot.on).toHaveBeenNthCalledWith(3, 'edited_message', requirePrivateChat, requireSetup, onEditedMessage);
    });
});

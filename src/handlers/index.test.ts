import type { DataService } from '@/services/types.js';
import type { Bot } from 'gramio';

import { onCustomize } from '@/commands/customize.js';
import { onSetup } from '@/commands/setup.js';
import { onStart } from '@/commands/start.js';
import { describe, expect, it, vi } from 'vitest';

import { onGenericMessage } from './genericMessage.js';
import { handleEditedMessage } from './handleEditedMessage.js';
import { registerHandlers } from './index.js';

vi.mock('@/commands/start.js', () => ({
    onStart: vi.fn(),
}));

vi.mock('@/commands/customize.js', () => ({
    CUSTOMIZE_COMMANDS: ['ack', 'failure'],
    onCustomize: vi.fn(),
}));

vi.mock('@/commands/setup.js', () => ({
    onSetup: vi.fn(),
}));

vi.mock('./genericMessage.js', () => ({
    onGenericMessage: vi.fn(),
}));

vi.mock('./handleEditedMessage.js', () => ({
    handleEditedMessage: vi.fn(),
}));

vi.mock('@/utils/logger.js', () => ({
    default: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
}));

describe('registerHandlers', () => {
    it('should register only setup handler when bot is not configured', async () => {
        const mockBot = {
            command: vi.fn(),
            derive: vi.fn().mockReturnThis(),
            on: vi.fn(),
            use: vi.fn(),
        };

        const mockDB = {
            getSettings: vi.fn().mockResolvedValue(null),
        };

        await registerHandlers(mockBot as unknown as Bot, mockDB as unknown as DataService);

        expect(mockBot.derive).toHaveBeenCalledTimes(1);

        expect(mockBot.command).toHaveBeenCalledTimes(1);
        expect(mockBot.command).toHaveBeenCalledWith('setup', onSetup);

        expect(mockBot.on).not.toHaveBeenCalled();
    });

    it('should register all handlers when bot is configured', async () => {
        const mockBot = {
            command: vi.fn(),
            derive: vi.fn().mockReturnThis(),
            on: vi.fn(),
            use: vi.fn(),
        };

        const mockSettings = { adminGroupId: '123456' };
        const mockDB = {
            getSettings: vi.fn().mockResolvedValue(mockSettings),
        };

        await registerHandlers(mockBot as unknown as Bot, mockDB as unknown as DataService);

        expect(mockBot.derive).toHaveBeenCalledTimes(1);

        expect(mockBot.command).toHaveBeenCalledTimes(4);
        expect(mockBot.command).toHaveBeenCalledWith('setup', onSetup);
        expect(mockBot.command).toHaveBeenCalledWith('start', onStart);
        expect(mockBot.command).toHaveBeenCalledWith('ack', onCustomize);
        expect(mockBot.command).toHaveBeenCalledWith('failure', onCustomize);

        expect(mockBot.on).toHaveBeenCalledTimes(2);
        expect(mockBot.on).toHaveBeenNthCalledWith(1, 'message', onGenericMessage);
        expect(mockBot.on).toHaveBeenNthCalledWith(2, 'edited_message', handleEditedMessage);
    });

    it('should pass settings to context derivation', async () => {
        const me = { first_name: 'Bot' };

        const mockBot = {
            api: { getMe: vi.fn().mockResolvedValue(me) },
            command: vi.fn(),
            derive: vi.fn().mockReturnThis(),
            on: vi.fn(),
            use: vi.fn(),
        };

        const mockSettings = { adminGroupId: '123456' };
        const mockDB = {
            getSettings: vi.fn().mockResolvedValue(mockSettings),
        };

        await registerHandlers(mockBot as unknown as Bot, mockDB as unknown as DataService);

        const deriveCallback = mockBot.derive.mock.calls[0][0];
        expect(typeof deriveCallback).toBe('function');

        const derivedContext = await deriveCallback();

        expect(derivedContext).toEqual({
            bot: mockBot,
            db: mockDB,
            me,
            settings: mockSettings,
        });
    });
});

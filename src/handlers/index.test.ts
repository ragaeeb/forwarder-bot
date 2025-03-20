import type { DataService } from '@/services/types.js';
import type { Bot } from 'gramio';

import { onSetup } from '@/commands/setup.js';
import { onStart } from '@/commands/start.js';
import { describe, expect, it, vi } from 'vitest';

import { onGenericMessage } from './genericMessage.js';
import { handleEditedMessage } from './handleEditedMessage.js';
import { registerHandlers } from './index.js';

vi.mock('@/commands/start.js', () => ({
    onStart: vi.fn(),
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
        };

        const mockSettings = { adminGroupId: '123456' };
        const mockDB = {
            getSettings: vi.fn().mockResolvedValue(mockSettings),
        };

        await registerHandlers(mockBot as unknown as Bot, mockDB as unknown as DataService);

        expect(mockBot.derive).toHaveBeenCalledTimes(1);

        expect(mockBot.command).toHaveBeenCalledTimes(2);
        expect(mockBot.command).toHaveBeenCalledWith('setup', onSetup);
        expect(mockBot.command).toHaveBeenCalledWith('start', onStart);

        expect(mockBot.on).toHaveBeenCalledTimes(2);
        expect(mockBot.on).toHaveBeenNthCalledWith(1, 'message', onGenericMessage);
        expect(mockBot.on).toHaveBeenNthCalledWith(2, 'edited_message', handleEditedMessage);
    });

    it('should pass settings to context derivation', async () => {
        const mockBot = {
            command: vi.fn(),
            derive: vi.fn().mockReturnThis(),
            on: vi.fn(),
        };

        const mockSettings = { adminGroupId: '123456' };
        const mockDB = {
            getSettings: vi.fn().mockResolvedValue(mockSettings),
        };

        await registerHandlers(mockBot as unknown as Bot, mockDB as unknown as DataService);

        // Verify derive callback includes settings
        const deriveCallback = mockBot.derive.mock.calls[0][0];
        expect(typeof deriveCallback).toBe('function');

        // Execute the derive callback
        const derivedContext = await deriveCallback();

        // Check the derived context
        expect(derivedContext).toEqual({
            bot: mockBot,
            db: mockDB,
            settings: mockSettings,
        });
    });
});

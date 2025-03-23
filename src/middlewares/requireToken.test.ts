import type { NextFunction } from '@/bot.js';
import type { ForwardContext } from '@/types.js';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requireToken } from './requireToken.js';

vi.mock('@/utils/security.js', () => ({
    hashToken: vi.fn().mockReturnValue('HBT'),
}));

describe('requireToken', () => {
    let next: NextFunction;

    beforeEach(() => {
        vi.clearAllMocks();
        next = vi.fn();
    });

    it('should do nothing when token is not provided', () => {
        requireToken({} as unknown as ForwardContext, next);

        expect(next).not.toHaveBeenCalled();
    });

    it('should do nothing when an invalid token is provided', () => {
        requireToken({ args: Date.now().toString() } as unknown as ForwardContext, next);

        expect(next).not.toHaveBeenCalled();
    });

    it('should pass if correct token is provided', () => {
        requireToken({ args: 'HBT' } as unknown as ForwardContext, next);

        expect(next).toHaveBeenCalledExactlyOnceWith();
    });
});

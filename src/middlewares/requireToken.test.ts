import type { NextFunction } from '@/bot.js';
import type { ForwardContext } from '@/types/app.js';

import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { requireToken } from './requireToken.js';

mock.module('@/utils/security.js', () => ({
    hashToken: mock(() => {}).mockReturnValue('HBT')}));

describe('requireToken', () => {
    let next: NextFunction;

    beforeEach(() => {
        mock.restore();
        next = mock(() => {});
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

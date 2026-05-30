import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import type { NextFunction } from '@/bot.js';
import type { ForwardContext } from '@/types/app.js';
import * as security from '@/utils/security.js';

import { requireToken } from './requireToken.js';

const hashTokenMock = mock(() => 'HBT');

mock.module('@/utils/security.js', () => ({
    hashToken: hashTokenMock,
}));

describe('requireToken', () => {
    let next: NextFunction;

    beforeEach(() => {
        mock.clearAllMocks();
        next = mock(() => {});
    });

    afterAll(() => {
        mock.module('@/utils/security.js', () => security);
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

        expect(next).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledWith();
    });
});

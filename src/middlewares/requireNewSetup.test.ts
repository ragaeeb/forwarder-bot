import type { NextFunction } from '@/bot.js';
import type { ForwardContext } from '@/types.js';

import { replyWithWarning } from '@/utils/replyUtils.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requireNewSetup } from './requireNewSetup.js';

vi.mock('@/utils/replyUtils.js');

describe('requireNewSetup', () => {
    let next: NextFunction;

    beforeEach(() => {
        vi.clearAllMocks();
        next = vi.fn();
    });

    it('should pass if setup was never completed', async () => {
        await requireNewSetup({} as unknown as ForwardContext, next);

        expect(next).toHaveBeenCalledExactlyOnceWith();
        expect(replyWithWarning).not.toHaveBeenCalled();
    });

    it('should pass if setup was completed with a different group', async () => {
        await requireNewSetup({ chat: { id: 2 }, settings: { adminGroupId: '1' } } as unknown as ForwardContext, next);

        expect(next).toHaveBeenCalledExactlyOnceWith();
        expect(replyWithWarning).not.toHaveBeenCalled();
    });

    it('should not pass if setup was completed for the same group', async () => {
        await requireNewSetup({ chat: { id: 1 }, settings: { adminGroupId: '1' } } as unknown as ForwardContext, next);

        expect(next).not.toHaveBeenCalled();
        expect(replyWithWarning).toHaveBeenCalledOnce();
    });
});

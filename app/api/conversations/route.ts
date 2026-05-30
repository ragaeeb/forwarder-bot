import { type NextRequest, NextResponse } from 'next/server';

import type { ThreadData } from '@/types/app';
import { getDataService } from '../../../lib/db/index';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 1), 100);
        const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0);

        const db = getDataService();
        const [threads, total] = await Promise.all([db.getAllThreads({ limit, offset }), db.getThreadCount()]);

        return NextResponse.json({ threads, total } as { threads: ThreadData[]; total: number });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

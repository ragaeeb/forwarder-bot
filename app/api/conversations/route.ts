import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '../../../lib/db/index.js';

/**
 * GET /api/conversations?limit=20&offset=0
 * Returns paginated list of all conversation threads.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') ?? '20', 10);
        const offset = parseInt(searchParams.get('offset') ?? '0', 10);

        const db = await getDb();
        const [threads, total] = await Promise.all([db.getAllThreads({ limit, offset }), db.getThreadCount()]);

        return NextResponse.json({ threads, total });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal server error', ok: false }, { status: 500 });
    }
}

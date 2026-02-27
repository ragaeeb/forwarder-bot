import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '../../../lib/db/index.js';

/**
 * GET /api/settings
 * Returns the current bot settings.
 */
export async function GET(): Promise<NextResponse> {
    try {
        const db = await getDb();
        const settings = await db.getSettings();

        if (!settings) {
            return NextResponse.json({ error: 'Settings not found', ok: false }, { status: 404 });
        }

        return NextResponse.json({ ok: true, settings });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal server error', ok: false }, { status: 500 });
    }
}

/**
 * PUT /api/settings
 * Updates bot settings (partial update supported).
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
    try {
        const db = await getDb();
        const existing = await db.getSettings();

        if (!existing) {
            return NextResponse.json({ error: 'Bot not configured yet', ok: false }, { status: 404 });
        }

        const updates = await request.json();
        const merged = { ...existing, ...updates };
        const saved = await db.saveSettings(merged);

        return NextResponse.json({ ok: true, settings: saved });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal server error', ok: false }, { status: 500 });
    }
}

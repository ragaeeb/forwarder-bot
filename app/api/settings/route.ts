import { type NextRequest, NextResponse } from 'next/server';

import type { BotSettings } from '@/types/app';
import { getDataService } from '../../../lib/db/index';

export async function GET() {
    try {
        const db = getDataService();
        const settings = await db.getSettings();

        if (!settings) {
            return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
        }

        return NextResponse.json(settings);
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        let body: Partial<BotSettings>;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const db = getDataService();
        const existing = await db.getSettings();

        if (!existing) {
            return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
        }

        const updated = await db.saveSettings({ ...existing, ...body });
        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

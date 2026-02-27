import { Bot } from '../../src/bot.js';
import { config } from '../../src/config.js';
import { registerHandlers } from '../../src/handlers/index.js';
import { getDb } from '../db/index.js';

// Module-level singleton — compatible with Next.js hot reload in dev
let _bot: Bot | null = null;

/**
 * Returns the singleton Bot instance, lazily initializing on first call.
 * Safe to call from Next.js API routes (cold start compatible).
 */
export async function getBot(): Promise<Bot> {
    if (_bot) return _bot;

    const db = await getDb();
    const bot = new Bot(config.BOT_TOKEN);
    registerHandlers(bot, db);
    _bot = bot;
    return _bot;
}

/**
 * Resets the bot singleton. Used in tests.
 */
export function resetBotInstance(): void {
    _bot = null;
}

import { Bot } from '@/bot';
import { config } from '@/config';
import { registerHandlers } from '@/handlers/index';
import { getDataService } from '../db/index';

const globalForBot = globalThis as unknown as { __bot: Bot | undefined };

/**
 * Returns a singleton Bot instance, lazily initialized on first call.
 * Uses globalThis for Next.js hot-reload safety.
 */
export function getBot(): Bot {
    if (!globalForBot.__bot) {
        if (!config.BOT_TOKEN) {
            throw new Error('BOT_TOKEN environment variable is required. Add it to your .env file.');
        }
        const bot = new Bot(config.BOT_TOKEN);
        const db = getDataService();
        registerHandlers(bot, db);
        globalForBot.__bot = bot;
    }
    return globalForBot.__bot;
}

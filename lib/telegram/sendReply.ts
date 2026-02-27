import { TelegramAPI } from '../../src/services/telegramAPI.js';
import { config } from '../../src/config.js';

const telegramAPI = new TelegramAPI(config.BOT_TOKEN);

/**
 * Sends a reply message to a Telegram user from the web UI.
 *
 * @param chatId - The user's Telegram chat ID
 * @param text - The text to send
 * @returns The sent message ID
 */
export async function sendReplyToUser(chatId: string, text: string): Promise<string> {
    const message = await telegramAPI.sendMessage({
        chat_id: chatId,
        text,
    });
    return String(message.message_id);
}

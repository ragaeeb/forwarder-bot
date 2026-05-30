import type { TelegramMessage } from '@/types/telegram';
import { getBot } from '../bot/instance';

/**
 * Sends a reply message via the bot singleton.
 * Used by the web UI to send messages to Telegram chats.
 *
 * @param chatId - The chat ID to send the message to (string or number)
 * @param text - The message text to send
 * @returns The sent Telegram message
 */
export async function sendReply(chatId: string | number, text: string): Promise<TelegramMessage> {
    const bot = getBot();
    return bot.api.sendMessage({ chat_id: chatId, text });
}

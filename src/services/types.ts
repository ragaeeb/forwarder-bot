import { BotSettings, SavedMessage, ThreadData } from '@/types.js';

export interface DataService {
    getMessagesByUserId(userId: string): Promise<SavedMessage[]>;
    getSettings(): Promise<BotSettings | undefined>;
    getThreadById(threadId: string): Promise<ThreadData | undefined>;
    getThreadByUserId(userId: string): Promise<ThreadData | undefined>;
    saveMessage(message: SavedMessage): Promise<SavedMessage>;
    saveSettings(config: BotSettings): Promise<BotSettings>;
    saveThread(thread: ThreadData): Promise<ThreadData>;
}

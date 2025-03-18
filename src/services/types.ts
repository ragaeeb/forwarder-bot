import { BotConfig, SavedMessage, ThreadData } from '@/types.js';

export interface DataService {
    getConfig(): Promise<BotConfig | undefined>;
    getMessagesByUserId(userId: string): Promise<SavedMessage[]>;
    getThreadById(threadId: string): Promise<ThreadData | undefined>;
    getThreadByUserId(userId: string): Promise<ThreadData | undefined>;
    saveConfig(config: BotConfig): Promise<BotConfig>;
    saveMessage(message: SavedMessage): Promise<SavedMessage>;
    saveThread(thread: ThreadData): Promise<ThreadData>;
}

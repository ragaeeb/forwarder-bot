import { type Client, createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { BotSettings, SavedMessage, ThreadData } from '../../src/types/app.js';
import type { DataService } from '../../src/services/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Reads the SQL schema file.
 */
const readSchema = (): string => {
    return readFileSync(resolve(__dirname, 'schema.sql'), 'utf-8');
};

/**
 * Maps a database row to BotSettings.
 */
const rowToSettings = (row: Record<string, any>): BotSettings => ({
    ack: row.ack ?? undefined,
    adminGroupId: row.admin_group_id,
    failure: row.failure ?? undefined,
    greeting: row.greeting ?? undefined,
    setupAt: row.setup_at,
    setupBy: JSON.parse(row.setup_by || 'null'),
});

/**
 * Maps a database row to ThreadData.
 */
const rowToThread = (row: Record<string, any>): ThreadData => ({
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at ?? undefined,
    lastMessageId: row.last_message_id ?? '',
    name: row.name,
    threadId: row.thread_id,
    unreadCount: row.unread_count ?? 0,
    updatedAt: row.updated_at,
    userId: row.user_id,
});

/**
 * Maps a database row to SavedMessage.
 */
const rowToMessage = (row: Record<string, any>): SavedMessage => ({
    caption: row.caption ?? undefined,
    chatId: row.chat_id,
    forwardOrigin: row.forward_origin ? JSON.parse(row.forward_origin) : undefined,
    from: {
        firstName: row.from_first_name ?? undefined,
        lastName: row.from_last_name ?? undefined,
        userId: row.from_user_id,
        username: row.from_username ?? undefined,
    },
    id: row.id,
    mediaId: row.media_id ?? undefined,
    mediaType: row.media_type ?? undefined,
    originalMessageId: row.original_message_id ?? undefined,
    quote: row.quote ?? undefined,
    replyToMessageId: row.reply_to_message_id ?? undefined,
    text: row.text ?? '',
    timestamp: row.timestamp,
    type: row.type as 'admin' | 'system' | 'user',
});

/**
 * Turso (libSQL) implementation of the DataService interface.
 */
export class TursoService implements DataService {
    private client: Client;

    constructor(url: string, authToken?: string) {
        this.client = createClient({ authToken, url });
    }

    /**
     * Initializes the database schema. Must be called before first use.
     */
    async initialize(): Promise<void> {
        const schema = readSchema();
        // Split by semicolons and run each statement separately
        const statements = schema
            .split(';')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        for (const stmt of statements) {
            await this.client.execute(stmt);
        }
    }

    async getSettings(): Promise<BotSettings | undefined> {
        const result = await this.client.execute({
            args: ['main'],
            sql: 'SELECT * FROM config WHERE config_id = ?',
        });
        if (!result.rows.length) return undefined;
        return rowToSettings(result.rows[0] as Record<string, any>);
    }

    async saveSettings(settings: BotSettings): Promise<BotSettings> {
        await this.client.execute({
            args: [
                'main',
                settings.adminGroupId,
                settings.ack ?? null,
                settings.greeting ?? null,
                settings.failure ?? null,
                settings.setupAt,
                JSON.stringify(settings.setupBy),
            ],
            sql: `INSERT OR REPLACE INTO config (config_id, admin_group_id, ack, greeting, failure, setup_at, setup_by)
                  VALUES (?, ?, ?, ?, ?, ?, ?)`,
        });
        return settings;
    }

    async getThreadById(threadId: string): Promise<ThreadData | undefined> {
        const result = await this.client.execute({
            args: [threadId],
            sql: 'SELECT * FROM threads WHERE thread_id = ? LIMIT 1',
        });
        if (!result.rows.length) return undefined;
        return rowToThread(result.rows[0] as Record<string, any>);
    }

    async getThreadByUserId(userId: string): Promise<ThreadData | undefined> {
        const result = await this.client.execute({
            args: [userId],
            sql: 'SELECT * FROM threads WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1',
        });
        if (!result.rows.length) return undefined;
        return rowToThread(result.rows[0] as Record<string, any>);
    }

    async saveThread(thread: ThreadData): Promise<ThreadData> {
        await this.client.execute({
            args: [
                thread.userId,
                thread.threadId,
                thread.name,
                thread.lastMessageId ?? null,
                thread.lastMessageAt ?? null,
                thread.unreadCount ?? 0,
                thread.createdAt,
                thread.updatedAt,
            ],
            sql: `INSERT OR REPLACE INTO threads
                  (user_id, thread_id, name, last_message_id, last_message_at, unread_count, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        });
        return thread;
    }

    async saveMessage(message: SavedMessage): Promise<SavedMessage> {
        await this.client.execute({
            args: [
                message.id,
                message.from.userId,
                message.chatId,
                message.id,
                message.from.userId,
                message.from.firstName ?? null,
                message.from.lastName ?? null,
                message.from.username ?? null,
                message.text ?? '',
                message.caption ?? null,
                message.mediaType ?? null,
                message.mediaId ?? null,
                message.forwardOrigin ? JSON.stringify(message.forwardOrigin) : null,
                message.quote ?? null,
                message.replyToMessageId ?? null,
                message.originalMessageId ?? null,
                message.type,
                message.timestamp,
            ],
            sql: `INSERT OR REPLACE INTO messages
                  (id, user_id, chat_id, message_id, from_user_id, from_first_name, from_last_name, from_username,
                   text, caption, media_type, media_id, forward_origin, quote, reply_to_message_id, original_message_id, type, timestamp)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        });
        return message;
    }

    async getMessagesByUserId(userId: string): Promise<SavedMessage[]> {
        const result = await this.client.execute({
            args: [userId],
            sql: 'SELECT * FROM messages WHERE user_id = ? ORDER BY timestamp DESC',
        });
        return result.rows.map((row) => rowToMessage(row as Record<string, any>));
    }

    async getAllThreads(options?: { limit?: number; offset?: number }): Promise<ThreadData[]> {
        const limit = options?.limit ?? 50;
        const offset = options?.offset ?? 0;
        const result = await this.client.execute({
            args: [limit, offset],
            sql: 'SELECT * FROM threads ORDER BY updated_at DESC LIMIT ? OFFSET ?',
        });
        return result.rows.map((row) => rowToThread(row as Record<string, any>));
    }

    async getThreadCount(): Promise<number> {
        const result = await this.client.execute('SELECT COUNT(*) as count FROM threads');
        const row = result.rows[0] as Record<string, any>;
        return Number(row.count ?? 0);
    }

    async getUnreadCount(userId: string): Promise<number> {
        const result = await this.client.execute({
            args: [userId],
            sql: 'SELECT unread_count FROM threads WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1',
        });
        if (!result.rows.length) return 0;
        const row = result.rows[0] as Record<string, any>;
        return Number(row.unread_count ?? 0);
    }

    async markThreadRead(userId: string): Promise<void> {
        await this.client.execute({
            args: [userId],
            sql: 'UPDATE threads SET unread_count = 0 WHERE user_id = ?',
        });
    }
}

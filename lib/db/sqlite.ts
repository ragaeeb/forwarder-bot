import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { BotSettings, SavedMessage, ThreadData } from '../../src/types/app.js';
import type { DataService } from '../../src/services/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Reads the SQL schema file and returns the SQL string.
 */
const readSchema = (): string => {
    return readFileSync(resolve(__dirname, 'schema.sql'), 'utf-8');
};

/**
 * Maps a database row to BotSettings object.
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
 * Maps a database row to ThreadData object.
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
 * Maps a database row to SavedMessage object.
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
 * SQLite implementation of the DataService interface.
 * Uses better-sqlite3 for synchronous database operations.
 */
export class SQLiteService implements DataService {
    private db: Database.Database;

    constructor(dbPath: string = ':memory:') {
        if (dbPath !== ':memory:') {
            mkdirSync(dirname(resolve(dbPath)), { recursive: true });
        }
        this.db = new Database(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
        this.initialize();
    }

    /**
     * Initialize the database schema.
     */
    private initialize(): void {
        const schema = readSchema();
        this.db.exec(schema);
    }

    /**
     * Closes the database connection.
     */
    close(): void {
        this.db.close();
    }

    async getSettings(): Promise<BotSettings | undefined> {
        const row = this.db.prepare('SELECT * FROM config WHERE config_id = ?').get('main') as
            | Record<string, any>
            | undefined;
        if (!row) return undefined;
        return rowToSettings(row);
    }

    async saveSettings(settings: BotSettings): Promise<BotSettings> {
        this.db
            .prepare(
                `INSERT OR REPLACE INTO config (config_id, admin_group_id, ack, greeting, failure, setup_at, setup_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(
                'main',
                settings.adminGroupId,
                settings.ack ?? null,
                settings.greeting ?? null,
                settings.failure ?? null,
                settings.setupAt,
                JSON.stringify(settings.setupBy),
            );
        return settings;
    }

    async getThreadById(threadId: string): Promise<ThreadData | undefined> {
        const row = this.db.prepare('SELECT * FROM threads WHERE thread_id = ? LIMIT 1').get(threadId) as
            | Record<string, any>
            | undefined;
        if (!row) return undefined;
        return rowToThread(row);
    }

    async getThreadByUserId(userId: string): Promise<ThreadData | undefined> {
        const row = this.db
            .prepare('SELECT * FROM threads WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1')
            .get(userId) as Record<string, any> | undefined;
        if (!row) return undefined;
        return rowToThread(row);
    }

    async saveThread(thread: ThreadData): Promise<ThreadData> {
        this.db
            .prepare(
                `INSERT OR REPLACE INTO threads (user_id, thread_id, name, last_message_id, last_message_at, unread_count, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(
                thread.userId,
                thread.threadId,
                thread.name,
                thread.lastMessageId ?? null,
                thread.lastMessageAt ?? null,
                thread.unreadCount ?? 0,
                thread.createdAt,
                thread.updatedAt,
            );
        return thread;
    }

    async saveMessage(message: SavedMessage): Promise<SavedMessage> {
        this.db
            .prepare(
                `INSERT OR REPLACE INTO messages
             (id, user_id, chat_id, message_id, from_user_id, from_first_name, from_last_name, from_username,
              text, caption, media_type, media_id, forward_origin, quote, reply_to_message_id, original_message_id, type, timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(
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
            );
        return message;
    }

    async getMessagesByUserId(userId: string): Promise<SavedMessage[]> {
        const rows = this.db
            .prepare('SELECT * FROM messages WHERE user_id = ? ORDER BY timestamp DESC')
            .all(userId) as Record<string, any>[];
        return rows.map(rowToMessage);
    }

    async getAllThreads(options?: { limit?: number; offset?: number }): Promise<ThreadData[]> {
        const limit = options?.limit ?? 50;
        const offset = options?.offset ?? 0;
        const rows = this.db
            .prepare('SELECT * FROM threads ORDER BY updated_at DESC LIMIT ? OFFSET ?')
            .all(limit, offset) as Record<string, any>[];
        return rows.map(rowToThread);
    }

    async getThreadCount(): Promise<number> {
        const row = this.db.prepare('SELECT COUNT(*) as count FROM threads').get() as { count: number };
        return row.count;
    }

    async getUnreadCount(userId: string): Promise<number> {
        const row = this.db
            .prepare('SELECT unread_count FROM threads WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1')
            .get(userId) as { unread_count: number } | undefined;
        return row?.unread_count ?? 0;
    }

    async markThreadRead(userId: string): Promise<void> {
        this.db.prepare('UPDATE threads SET unread_count = 0 WHERE user_id = ?').run(userId);
    }
}

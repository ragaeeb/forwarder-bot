import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DataService } from '@/services/types';
import type { BotSettings, SavedMessage, ThreadData } from '@/types/app';
import type { TelegramMessageOrigin, TelegramUser } from '@/types/telegram';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, 'schema.sql');

/**
 * SQLite driver: uses bun:sqlite (Bun-native, compatible API with better-sqlite3).
 * For Node.js runtime, substitute better-sqlite3: use db.exec(schema) and db.prepare(sql).
 */

function rowToBotSettings(row: Record<string, any>): BotSettings | undefined {
    if (!row.admin_group_id) return undefined;

    let setupBy: TelegramUser | undefined;
    if (row.setup_by && typeof row.setup_by === 'string') {
        try {
            setupBy = JSON.parse(row.setup_by) as TelegramUser;
        } catch {
            setupBy = undefined;
        }
    }
    if (!setupBy) return undefined;

    const result: BotSettings = {
        adminGroupId: String(row.admin_group_id),
        setupAt: String(row.setup_at),
        setupBy,
    };
    if (row.ack) result.ack = String(row.ack);
    if (row.greeting) result.greeting = String(row.greeting);
    if (row.failure) result.failure = String(row.failure);
    return result;
}

function rowToThreadData(row: Record<string, any>): ThreadData {
    return {
        userId: row.user_id as string,
        threadId: row.thread_id as string,
        name: row.name as string,
        lastMessageId: (row.last_message_id as string) ?? '',
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
    };
}

function rowToSavedMessage(row: Record<string, any>): SavedMessage {
    let forwardOrigin: TelegramMessageOrigin | undefined;
    if (row.forward_origin && typeof row.forward_origin === 'string') {
        try {
            forwardOrigin = JSON.parse(row.forward_origin) as TelegramMessageOrigin;
        } catch {
            forwardOrigin = undefined;
        }
    }

    const from: SavedMessage['from'] = { userId: String(row.from_user_id) };
    if (row.from_first_name) from.firstName = String(row.from_first_name);
    if (row.from_last_name) from.lastName = String(row.from_last_name);
    if (row.from_username) from.username = String(row.from_username);

    const msg: SavedMessage = {
        id: String(row.id),
        chatId: String(row.chat_id),
        from,
        text: String(row.text ?? ''),
        timestamp: String(row.timestamp),
        type: row.type as 'admin' | 'user',
    };
    if (row.caption) msg.caption = String(row.caption);
    if (row.media_type) msg.mediaType = String(row.media_type);
    if (row.media_id) msg.mediaId = String(row.media_id);
    if (forwardOrigin) msg.forwardOrigin = forwardOrigin;
    if (row.quote) msg.quote = String(row.quote);
    if (row.reply_to_message_id) msg.replyToMessageId = String(row.reply_to_message_id);
    if (row.original_message_id) msg.originalMessageId = String(row.original_message_id);
    return msg;
}

/**
 * SQLite implementation of the DataService interface.
 * Uses bun:sqlite with parameterized queries and prepared statements.
 */
export class SQLiteDataService implements DataService {
    private db: Database;

    constructor(dbPath: string = ':memory:') {
        this.db = new Database(dbPath);
        const schema = readFileSync(schemaPath, 'utf-8');
        this.db.run(schema);
    }

    async getMessagesByUserId(userId: string): Promise<SavedMessage[]> {
        const stmt = this.db.prepare(`SELECT * FROM messages WHERE user_id = ? ORDER BY timestamp DESC`);
        const rows = stmt.all(userId) as Record<string, any>[];
        return rows.map(rowToSavedMessage);
    }

    async getSettings(): Promise<BotSettings | undefined> {
        const stmt = this.db.prepare(`SELECT * FROM config WHERE config_id = ?`);
        const row = stmt.get('main') as Record<string, any> | undefined;
        return row ? rowToBotSettings(row) : undefined;
    }

    async getThreadById(threadId: string): Promise<ThreadData | undefined> {
        const stmt = this.db.prepare(`SELECT * FROM threads WHERE thread_id = ? LIMIT 1`);
        const row = stmt.get(threadId) as Record<string, any> | undefined;
        return row ? rowToThreadData(row) : undefined;
    }

    async getThreadByUserId(userId: string): Promise<ThreadData | undefined> {
        const stmt = this.db.prepare(`SELECT * FROM threads WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`);
        const row = stmt.get(userId) as Record<string, any> | undefined;
        return row ? rowToThreadData(row) : undefined;
    }

    async saveMessage(message: SavedMessage): Promise<SavedMessage> {
        const userId = message.from.userId;
        const forwardOriginJson = message.forwardOrigin ? JSON.stringify(message.forwardOrigin) : null;

        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO messages (
                id, user_id, chat_id, message_id, from_user_id, from_first_name,
                from_last_name, from_username, text, caption, media_type, media_id,
                forward_origin, quote, reply_to_message_id, original_message_id,
                type, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            message.id,
            userId,
            message.chatId,
            message.id,
            message.from.userId,
            message.from.firstName ?? null,
            message.from.lastName ?? null,
            message.from.username ?? null,
            message.text,
            message.caption ?? null,
            message.mediaType ?? null,
            message.mediaId ?? null,
            forwardOriginJson,
            message.quote ?? null,
            message.replyToMessageId ?? null,
            message.originalMessageId ?? null,
            message.type,
            message.timestamp,
        );

        return message;
    }

    async saveSettings(config: BotSettings): Promise<BotSettings> {
        const setupByJson = JSON.stringify(config.setupBy);

        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO config (
                config_id, admin_group_id, ack, greeting, failure, setup_at, setup_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            'main',
            config.adminGroupId,
            config.ack ?? null,
            config.greeting ?? null,
            config.failure ?? null,
            config.setupAt,
            setupByJson,
        );

        return config;
    }

    async saveThread(thread: ThreadData): Promise<ThreadData> {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO threads (
                user_id, thread_id, name, last_message_id, last_message_at,
                unread_count, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, COALESCE(
                (SELECT unread_count FROM threads WHERE user_id = ? AND thread_id = ?),
                0
            ), ?, ?)
        `);

        stmt.run(
            thread.userId,
            thread.threadId,
            thread.name,
            thread.lastMessageId ?? null,
            thread.updatedAt,
            thread.userId,
            thread.threadId,
            thread.createdAt,
            thread.updatedAt,
        );

        return thread;
    }

    async getAllThreads(options?: { limit?: number; offset?: number }): Promise<ThreadData[]> {
        const limit = options?.limit ?? 100;
        const offset = options?.offset ?? 0;

        const stmt = this.db.prepare(`SELECT * FROM threads ORDER BY updated_at DESC LIMIT ? OFFSET ?`);
        const rows = stmt.all(limit, offset) as Record<string, any>[];
        return rows.map(rowToThreadData);
    }

    async getThreadCount(): Promise<number> {
        const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM threads`);
        const row = stmt.get() as { count: number };
        return row.count;
    }

    async getUnreadCount(userId: string): Promise<number> {
        const stmt = this.db.prepare(`SELECT COALESCE(SUM(unread_count), 0) as total FROM threads WHERE user_id = ?`);
        const row = stmt.get(userId) as { total: number } | undefined;
        return row?.total ?? 0;
    }

    async markThreadRead(userId: string): Promise<void> {
        const stmt = this.db.prepare(`UPDATE threads SET unread_count = 0 WHERE user_id = ?`);
        stmt.run(userId);
    }
}

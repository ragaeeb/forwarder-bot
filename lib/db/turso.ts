import { type Client, createClient } from '@libsql/client';

import type { DataService } from '@/services/types';
import type { BotSettings, SavedMessage, ThreadData } from '@/types/app';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS config (
  config_id TEXT PRIMARY KEY DEFAULT 'main',
  admin_group_id TEXT,
  ack TEXT,
  greeting TEXT,
  failure TEXT,
  setup_at TEXT,
  setup_by TEXT
);
CREATE TABLE IF NOT EXISTS threads (
  user_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  name TEXT NOT NULL,
  last_message_id TEXT,
  last_message_at TEXT,
  unread_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, thread_id)
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  message_id TEXT,
  from_user_id TEXT NOT NULL,
  from_first_name TEXT,
  from_last_name TEXT,
  from_username TEXT,
  text TEXT DEFAULT '',
  caption TEXT,
  media_type TEXT,
  media_id TEXT,
  forward_origin TEXT,
  quote TEXT,
  reply_to_message_id TEXT,
  original_message_id TEXT,
  type TEXT NOT NULL CHECK(type IN ('user', 'admin', 'system')),
  timestamp TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_threads_updated ON threads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_thread_id ON threads(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id, timestamp DESC);
`;

export interface TursoConfig {
    url: string;
    authToken: string;
}

export class TursoDataService implements DataService {
    private client: Client;

    constructor(config: TursoConfig) {
        this.client = createClient({
            url: config.url,
            authToken: config.authToken,
        });
    }

    async initialize(): Promise<void> {
        const statements = SCHEMA_SQL.trim()
            .split(';')
            .map((s) => s.trim())
            .filter(Boolean);
        await this.client.batch(statements, 'write');
    }

    async getMessagesByUserId(userId: string): Promise<SavedMessage[]> {
        const result = await this.client.execute({
            sql: `SELECT * FROM messages WHERE user_id = ? ORDER BY timestamp DESC`,
            args: [userId],
        });
        return result.rows.map((row) => rowToSavedMessage(row));
    }

    async getSettings(): Promise<BotSettings | undefined> {
        const result = await this.client.execute({
            sql: `SELECT * FROM config WHERE config_id = ?`,
            args: ['main'],
        });
        if (result.rows.length === 0) return undefined;
        return rowToBotSettings(result.rows[0]);
    }

    async getThreadById(threadId: string): Promise<ThreadData | undefined> {
        const result = await this.client.execute({
            sql: `SELECT * FROM threads WHERE thread_id = ? LIMIT 1`,
            args: [threadId],
        });
        if (result.rows.length === 0) return undefined;
        return rowToThreadData(result.rows[0]);
    }

    async getThreadByUserId(userId: string): Promise<ThreadData | undefined> {
        const result = await this.client.execute({
            sql: `SELECT * FROM threads WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`,
            args: [userId],
        });
        if (result.rows.length === 0) return undefined;
        return rowToThreadData(result.rows[0]);
    }

    async saveMessage(message: SavedMessage): Promise<SavedMessage> {
        const userId = message.from.userId;
        await this.client.execute({
            sql: `INSERT OR REPLACE INTO messages (
        id, user_id, chat_id, message_id, from_user_id, from_first_name, from_last_name, from_username,
        text, caption, media_type, media_id, forward_origin, quote, reply_to_message_id, original_message_id,
        type, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
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
                message.forwardOrigin ? JSON.stringify(message.forwardOrigin) : null,
                message.quote ?? null,
                message.replyToMessageId ?? null,
                message.originalMessageId ?? null,
                message.type,
                message.timestamp,
            ],
        });
        return message;
    }

    async saveSettings(config: BotSettings): Promise<BotSettings> {
        const setupByJson = JSON.stringify(config.setupBy);
        await this.client.execute({
            sql: `INSERT OR REPLACE INTO config (config_id, admin_group_id, ack, greeting, failure, setup_at, setup_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
            args: [
                'main',
                config.adminGroupId,
                config.ack ?? null,
                config.greeting ?? null,
                config.failure ?? null,
                config.setupAt,
                setupByJson,
            ],
        });
        return config;
    }

    async saveThread(thread: ThreadData): Promise<ThreadData> {
        await this.client.execute({
            sql: `INSERT INTO threads (user_id, thread_id, name, last_message_id, last_message_at, unread_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 0, ?, ?)
        ON CONFLICT (user_id, thread_id) DO UPDATE SET
          name = excluded.name,
          last_message_id = excluded.last_message_id,
          last_message_at = excluded.last_message_at,
          updated_at = excluded.updated_at`,
            args: [
                thread.userId,
                thread.threadId,
                thread.name,
                thread.lastMessageId,
                thread.updatedAt,
                thread.createdAt,
                thread.updatedAt,
            ],
        });
        return thread;
    }

    async getAllThreads(options?: { limit?: number; offset?: number }): Promise<ThreadData[]> {
        const limit = options?.limit ?? 100;
        const offset = options?.offset ?? 0;
        const result = await this.client.execute({
            sql: `SELECT * FROM threads ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
            args: [limit, offset],
        });
        return result.rows.map((row) => rowToThreadData(row));
    }

    async getThreadCount(): Promise<number> {
        const result = await this.client.execute({
            sql: `SELECT COUNT(*) as count FROM threads`,
            args: [],
        });
        return Number(result.rows[0]?.count ?? 0);
    }

    async getUnreadCount(userId: string): Promise<number> {
        const result = await this.client.execute({
            sql: `SELECT COALESCE(SUM(unread_count), 0) as total FROM threads WHERE user_id = ?`,
            args: [userId],
        });
        return Number(result.rows[0]?.total ?? 0);
    }

    async markThreadRead(userId: string): Promise<void> {
        await this.client.execute({
            sql: `UPDATE threads SET unread_count = 0 WHERE user_id = ?`,
            args: [userId],
        });
    }
}

function rowToBotSettings(row: Record<string, any>): BotSettings {
    const setupByRaw = row.setup_by;
    const setupBy =
        typeof setupByRaw === 'string'
            ? (JSON.parse(setupByRaw) as BotSettings['setupBy'])
            : (setupByRaw as BotSettings['setupBy']);
    const result: BotSettings = {
        adminGroupId: String(row.admin_group_id ?? ''),
        setupAt: String(row.setup_at ?? ''),
        setupBy,
    };
    if (row.ack) result.ack = String(row.ack);
    if (row.failure) result.failure = String(row.failure);
    if (row.greeting) result.greeting = String(row.greeting);
    return result;
}

function rowToThreadData(row: Record<string, any>): ThreadData {
    return {
        userId: String(row.user_id ?? ''),
        threadId: String(row.thread_id ?? ''),
        name: String(row.name ?? ''),
        lastMessageId: String(row.last_message_id ?? ''),
        createdAt: String(row.created_at ?? ''),
        updatedAt: String(row.updated_at ?? ''),
    };
}

function rowToSavedMessage(row: Record<string, any>): SavedMessage {
    const forwardOriginRaw = row.forward_origin;
    const forwardOrigin =
        typeof forwardOriginRaw === 'string' && forwardOriginRaw
            ? (JSON.parse(forwardOriginRaw) as SavedMessage['forwardOrigin'])
            : undefined;

    const from: SavedMessage['from'] = { userId: String(row.from_user_id ?? '') };
    if (row.from_first_name) from.firstName = String(row.from_first_name);
    if (row.from_last_name) from.lastName = String(row.from_last_name);
    if (row.from_username) from.username = String(row.from_username);

    const msg: SavedMessage = {
        id: String(row.id ?? ''),
        chatId: String(row.chat_id ?? ''),
        from,
        text: String(row.text ?? ''),
        timestamp: String(row.timestamp ?? ''),
        type: (row.type as 'admin' | 'user') ?? 'user',
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

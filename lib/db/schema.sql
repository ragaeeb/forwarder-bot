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

CREATE INDEX IF NOT EXISTS idx_threads_updated ON threads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_thread_id ON threads(thread_id);

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
  timestamp TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES threads(user_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id, timestamp DESC);

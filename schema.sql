CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  note TEXT,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS journals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS health_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  sys INTEGER,
  dia INTEGER,
  hr INTEGER,
  weight REAL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS vault_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  site TEXT NOT NULL,
  username TEXT NOT NULL,
  secret_ciphertext TEXT NOT NULL,
  secret_iv TEXT NOT NULL,
  secret_preview TEXT NOT NULL DEFAULT '********',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS line_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_type TEXT NOT NULL,          -- user | group | room (LINE chat source type)
  room_id TEXT NOT NULL,            -- userId (1:1), groupId, or roomId
  user_id TEXT,                     -- sender's LINE userId (null if unavailable)
  message_type TEXT NOT NULL,       -- text | image | video | audio | sticker | ...
  text TEXT,                        -- content for text messages, null otherwise
  line_message_id TEXT,             -- LINE message id (dedupe key)
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_line_messages_message_id ON line_messages(line_message_id);
CREATE INDEX IF NOT EXISTS idx_line_messages_room_created ON line_messages(room_type, room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_line_messages_user_created ON line_messages(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_journals_user_created_at ON journals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_user_recorded_at ON health_daily(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_vault_user_site ON vault_items(user_id, site);

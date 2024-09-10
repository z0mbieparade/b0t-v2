


CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL,
    value TEXT,
    UNIQUE(key)
);

CREATE TABLE IF NOT EXISTS servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    server TEXT NOT NULL, 
    token TEXT,  
    port INTEGER,
    ssl BOOLEAN,
    nickname TEXT
);

CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id INTEGER,
    channel TEXT NOT NULL,  
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    UNIQUE(server_id, channel)
);

-- there could be an issue where two users use the same nickname on the same server??
CREATE TABLE IF NOT EXISTS nicks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id INTEGER,
    nick TEXT UNIQUE NOT NULL,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    UNIQUE(nick, server_id)
);

-- link to another nickname on another server
CREATE TABLE IF NOT EXISTS nick_link (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nick_id_1 INTEGER,
    nick_id_2 INTEGER,
    FOREIGN KEY (nick_id_1) REFERENCES nicks(id) ON DELETE CASCADE,
    FOREIGN KEY (nick_id_2) REFERENCES nicks(id) ON DELETE CASCADE,
    UNIQUE(nick_id_1, nick_id_2)
);

-- alias of nickname on same server
CREATE TABLE IF NOT EXISTS nick_alias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alias TEXT UNIQUE NOT NULL,
    nick_id INTEGER,
    FOREIGN KEY (nick_id) REFERENCES nicks(id) ON DELETE CASCADE,
    UNIQUE(nick_id, alias)
);

-- key:value table of any extra user data
CREATE TABLE IF NOT EXISTS nick_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nick_id INTEGER,
    key TEXT NOT NULL,
    value TEXT,
    FOREIGN KEY (nick_id) REFERENCES nicks(id) ON DELETE CASCADE,
    UNIQUE(nick_id, key)
);

-- these are tag lines that are said when the user enters the channel
CREATE TABLE IF NOT EXISTS nick_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nick_id INTEGER,
    tag TEXT,
    FOREIGN KEY (nick_id) REFERENCES nicks(id) ON DELETE CASCADE
);

-- when a user was last seen
CREATE TABLE IF NOT EXISTS nick_seen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nick_id INTEGER,
    date INTEGER,
    chan TEXT,
    action TEXT,
    where_at TEXT,
    FOREIGN KEY (nick_id) REFERENCES nicks(id) ON DELETE CASCADE
);

-- keep track of various ips a user has joined from
CREATE TABLE IF NOT EXISTS nick_ips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nick_id INTEGER,
    ip_address TEXT,
    FOREIGN KEY (nick_id) REFERENCES nicks(id) ON DELETE CASCADE
);

-- when a user last spoke
CREATE TABLE IF NOT EXISTS nick_spoken (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nick_id INTEGER,
    date INTEGER,
    text TEXT,
    words INTEGER,
    letters INTEGER,
    lines INTEGER,
    FOREIGN KEY (nick_id) REFERENCES nicks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bugs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS speak (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id INTEGER NOT NULL,
    channel_id INTEGER NOT NULL,
    nick_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (nick_id) REFERENCES nicks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nick_id INTEGER,
    who TEXT,
    at_in TEXT,
    time INTEGER,
    to_do TEXT,
    who_set TEXT,
    offset INTEGER,
    timezone TEXT,
    FOREIGN KEY (nick_id) REFERENCES nicks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS kinkshame (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id INTEGER NOT NULL,
    channel_id INTEGER NOT NULL,
    user TEXT NOT NULL,
    shame TEXT NOT NULL,
    shamed_by INTEGER NOT NULL,
    `when` INTEGER NOT NULL,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (shamed_by) REFERENCES nicks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS infobot (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id INTEGER NOT NULL,
    channel_id INTEGER NOT NULL,
    nick_id INTEGER NOT NULL,
    plural BOOLEAN NOT NULL,
    info TEXT NOT NULL,
    determiner TEXT,
    lock BOOLEAN NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (nick_id) REFERENCES nicks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id INTEGER NOT NULL,
    channel_id INTEGER NOT NULL,
    nick_id INTEGER NOT NULL,
    topic TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (nick_id) REFERENCES nicks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS polls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id INTEGER NOT NULL,
    channel_id INTEGER NOT NULL,
    nick_id INTEGER NOT NULL,
    question TEXT NOT NULL,
    status TEXT NOT NULL,  -- e.g., 'open', 'closed'
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (nick_id) REFERENCES nicks(id) ON DELETE CASCADE,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS poll_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id INTEGER NOT NULL,
    answer TEXT NOT NULL,
    FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS poll_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id INTEGER NOT NULL,
    answer_id INTEGER NOT NULL,
    nick_id INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
    FOREIGN KEY (answer_id) REFERENCES poll_answers(id) ON DELETE CASCADE,
    FOREIGN KEY (nick_id) REFERENCES nicks(id) ON DELETE CASCADE,
    UNIQUE(poll_id, nick_id)  -- Ensure a user can only vote once per poll
);

CREATE TABLE IF NOT EXISTS creeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id INTEGER NOT NULL,
    creed TEXT NOT NULL,
    disabled BOOLEAN NOT NULL DEFAULT 0,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cah_packs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    official BOOLEAN NOT NULL,
    disabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_by TEXT DEFAULT 'b0t'
);

CREATE TABLE IF NOT EXISTS cah_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pack_id INTEGER NOT NULL,
    text TEXT NOT NULL, 
    type TEXT NOT NULL CHECK(type IN ('white', 'black')),
    cid INTEGER,              -- Custom card ID from JSON
    pid INTEGER,              -- Pack ID from JSON
    disabled BOOLEAN DEFAULT 0,  -- Set to true if r:1, otherwise false
    created_by TEXT DEFAULT 'b0t',
    FOREIGN KEY (pack_id) REFERENCES cah_packs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scopes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sign TEXT NOT NULL,
    scope_text TEXT NOT NULL,
    created_by TEXT DEFAULT 'b0t'
);

CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    word TEXT NOT NULL,
    created_by TEXT DEFAULT 'b0t'
);

CREATE TABLE IF NOT EXISTS insults (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    insult TEXT NOT NULL,
    created_by TEXT DEFAULT 'b0t'
);

CREATE TABLE IF NOT EXISTS file_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT UNIQUE NOT NULL,
    last_modified INTEGER NOT NULL
);

DROP TABLE IF EXISTS user_agents;
CREATE TABLE IF NOT EXISTS user_agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_agent TEXT NOT NULL,
    value REAL NOT NULL
);
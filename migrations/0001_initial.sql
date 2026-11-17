CREATE TABLE IF NOT EXISTS contacts (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 email TEXT NOT NULL COLLATE NOCASE UNIQUE,
 title TEXT NOT NULL DEFAULT '',
 department TEXT NOT NULL,
 college TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS interactions (
 id TEXT PRIMARY KEY,
 contact_id TEXT NOT NULL REFERENCES contacts(id),
 interaction_date TEXT NOT NULL,
 service TEXT NOT NULL,
 description TEXT NOT NULL,
 staff_member TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS interactions_contact ON interactions(contact_id);
CREATE INDEX IF NOT EXISTS interactions_date ON interactions(interaction_date);

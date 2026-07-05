const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "library.db");
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    email      TEXT    NOT NULL UNIQUE,
    password   TEXT    NOT NULL,
    role       TEXT    NOT NULL DEFAULT 'librarian', -- 'admin' | 'librarian'
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS books (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT    NOT NULL,
    author       TEXT    NOT NULL,
    isbn         TEXT    UNIQUE,
    category     TEXT    NOT NULL DEFAULT 'General',
    total_copies INTEGER NOT NULL DEFAULT 1,
    available    INTEGER NOT NULL DEFAULT 1,
    publisher    TEXT,
    year         INTEGER,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS members (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL UNIQUE,
    phone      TEXT,
    address    TEXT,
    member_id  TEXT NOT NULL UNIQUE,
    status     TEXT NOT NULL DEFAULT 'active', -- 'active' | 'suspended'
    joined_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS borrows (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id     INTEGER NOT NULL REFERENCES books(id),
    member_id   INTEGER NOT NULL REFERENCES members(id),
    borrow_date TEXT    NOT NULL DEFAULT (datetime('now')),
    due_date    TEXT    NOT NULL,
    return_date TEXT,
    status      TEXT    NOT NULL DEFAULT 'borrowed', -- 'borrowed' | 'returned' | 'overdue'
    fine        REAL    NOT NULL DEFAULT 0
  );
`);

// ── Seed default admin account ───────────────────────────────────────────────

const bcrypt = require("bcryptjs");

const adminExists = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
if (!adminExists) {
  const hash = bcrypt.hashSync("admin123", 10);
  db.prepare(`
    INSERT INTO users (name, email, password, role)
    VALUES ('Admin', 'admin@library.com', ?, 'admin')
  `).run(hash);
  console.log("Default admin created: admin@library.com / admin123");
}

module.exports = db;

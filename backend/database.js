const sqlite3 = require("sqlite3").verbose();
const path    = require("path");
const bcrypt  = require("bcryptjs");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "library.db");

// ── Open database ─────────────────────────────────────────────────────────────
const raw = new sqlite3.Database(DB_PATH, (err) => {
  if (err) { console.error("Failed to open database:", err); process.exit(1); }
  console.log("SQLite connected:", DB_PATH);
});

// ── Promise helpers (keeps route code readable) ───────────────────────────────
const db = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      raw.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      raw.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  },
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      raw.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  },
  exec(sql) {
    return new Promise((resolve, reject) => {
      raw.exec(sql, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  },
};

// ── Schema + seed (runs once at startup) ─────────────────────────────────────
async function init() {
  await db.run("PRAGMA journal_mode = WAL");
  await db.run("PRAGMA foreign_keys = ON");

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      email      TEXT    NOT NULL UNIQUE,
      password   TEXT    NOT NULL,
      role       TEXT    NOT NULL DEFAULT 'librarian',
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
      status     TEXT NOT NULL DEFAULT 'active',
      joined_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS borrows (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id     INTEGER NOT NULL REFERENCES books(id),
      member_id   INTEGER NOT NULL REFERENCES members(id),
      borrow_date TEXT    NOT NULL DEFAULT (datetime('now')),
      due_date    TEXT    NOT NULL,
      return_date TEXT,
      status      TEXT    NOT NULL DEFAULT 'borrowed',
      fine        REAL    NOT NULL DEFAULT 0
    );
  `);

  // Seed default admin
  const admin = await db.get("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (!admin) {
    const hash = bcrypt.hashSync("admin123", 10);
    await db.run(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
      ["Admin", "admin@library.com", hash, "admin"]
    );
    console.log("Default admin created: admin@library.com / admin123");
  }
}

init().catch((err) => { console.error("DB init failed:", err); process.exit(1); });

module.exports = db;

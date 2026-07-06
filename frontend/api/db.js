const { Pool } = require("pg");
const bcrypt   = require("bcryptjs");

const DB_URL = process.env.DATABASE_URL
  || "postgresql://neondb_owner:npg_jAqStpZ74BMx@ep-ancient-butterfly-aob0xid2-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

let pool;
function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  }
  return pool;
}

async function query(text, params) {
  const client = await getPool().connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

async function initDB() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      role       TEXT NOT NULL DEFAULT 'librarian',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS books (
      id           SERIAL PRIMARY KEY,
      title        TEXT NOT NULL,
      author       TEXT NOT NULL,
      isbn         TEXT UNIQUE,
      category     TEXT NOT NULL DEFAULT 'General',
      total_copies INTEGER NOT NULL DEFAULT 1,
      available    INTEGER NOT NULL DEFAULT 1,
      publisher    TEXT,
      year         INTEGER,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS members (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL UNIQUE,
      phone      TEXT,
      address    TEXT,
      member_id  TEXT NOT NULL UNIQUE,
      status     TEXT NOT NULL DEFAULT 'active',
      joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS borrows (
      id          SERIAL PRIMARY KEY,
      book_id     INTEGER NOT NULL REFERENCES books(id),
      member_id   INTEGER NOT NULL REFERENCES members(id),
      borrow_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      due_date    DATE NOT NULL,
      return_date DATE,
      status      TEXT NOT NULL DEFAULT 'borrowed',
      fine        NUMERIC(10,2) NOT NULL DEFAULT 0
    );
  `);

  const { rows } = await query("SELECT id FROM users WHERE role='admin' LIMIT 1");
  if (rows.length === 0) {
    const hash = bcrypt.hashSync("admin123", 10);
    await query(
      "INSERT INTO users (name,email,password,role) VALUES ($1,$2,$3,$4)",
      ["Admin", "admin@library.com", hash, "admin"]
    );
    console.log("Default admin created: admin@library.com / admin123");
  }
}

module.exports = { query, initDB };

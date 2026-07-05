const express = require("express");
const { query } = require("../database");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

// GET /api/books/meta/categories — must be before /:id
router.get("/meta/categories", async (req, res, next) => {
  try {
    const { rows } = await query("SELECT DISTINCT category FROM books ORDER BY category");
    res.json(rows.map((r) => r.category));
  } catch (err) { next(err); }
});

// GET /api/books
router.get("/", async (req, res, next) => {
  try {
    const { search, category } = req.query;
    const params = [];
    let where = "WHERE 1=1";

    if (search) {
      params.push(`%${search}%`);
      where += ` AND (title ILIKE $${params.length} OR author ILIKE $${params.length} OR isbn ILIKE $${params.length})`;
    }
    if (category) {
      params.push(category);
      where += ` AND category = $${params.length}`;
    }

    const { rows } = await query(`SELECT * FROM books ${where} ORDER BY title ASC`, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/books/:id
router.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await query("SELECT * FROM books WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Book not found" });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/books
router.post("/", async (req, res, next) => {
  try {
    const { title, author, isbn, category = "General", total_copies = 1, publisher, year } = req.body;
    if (!title || !author)
      return res.status(400).json({ error: "title and author are required" });

    const { rows } = await query(
      `INSERT INTO books (title, author, isbn, category, total_copies, available, publisher, year)
       VALUES ($1,$2,$3,$4,$5,$5,$6,$7) RETURNING *`,
      [title, author, isbn || null, category, Number(total_copies), publisher || null, year || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "ISBN already exists" });
    next(err);
  }
});

// PUT /api/books/:id
router.put("/:id", async (req, res, next) => {
  try {
    const { rows: existing } = await query("SELECT * FROM books WHERE id = $1", [req.params.id]);
    const book = existing[0];
    if (!book) return res.status(404).json({ error: "Book not found" });

    const { title, author, isbn, category, total_copies, publisher, year } = req.body;
    const borrowed     = book.total_copies - book.available;
    const newTotal     = total_copies !== undefined ? Number(total_copies) : book.total_copies;
    const newAvailable = Math.max(0, newTotal - borrowed);

    const { rows } = await query(
      `UPDATE books SET title=$1, author=$2, isbn=$3, category=$4,
       total_copies=$5, available=$6, publisher=$7, year=$8 WHERE id=$9 RETURNING *`,
      [
        title     ?? book.title,
        author    ?? book.author,
        isbn      !== undefined ? isbn      : book.isbn,
        category  ?? book.category,
        newTotal,
        newAvailable,
        publisher !== undefined ? publisher : book.publisher,
        year      !== undefined ? year      : book.year,
        req.params.id,
      ]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/books/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const { rows: existing } = await query("SELECT * FROM books WHERE id = $1", [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: "Book not found" });

    const { rows: active } = await query(
      "SELECT id FROM borrows WHERE book_id = $1 AND status = 'borrowed' LIMIT 1",
      [req.params.id]
    );
    if (active[0]) return res.status(400).json({ error: "Cannot delete book with active borrows" });

    await query("DELETE FROM books WHERE id = $1", [req.params.id]);
    res.json({ message: "Book deleted" });
  } catch (err) { next(err); }
});

module.exports = router;

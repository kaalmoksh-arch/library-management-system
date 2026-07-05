const express = require("express");
const db      = require("../database");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

// GET /api/books/meta/categories  — must be before /:id
router.get("/meta/categories", async (req, res, next) => {
  try {
    const rows = await db.all("SELECT DISTINCT category FROM books ORDER BY category");
    res.json(rows.map((r) => r.category));
  } catch (err) { next(err); }
});

// GET /api/books
router.get("/", async (req, res, next) => {
  try {
    const { search, category } = req.query;
    let sql = "SELECT * FROM books WHERE 1=1";
    const params = [];

    if (search) {
      sql += " AND (title LIKE ? OR author LIKE ? OR isbn LIKE ?)";
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    if (category) {
      sql += " AND category = ?";
      params.push(category);
    }
    sql += " ORDER BY title ASC";
    res.json(await db.all(sql, params));
  } catch (err) { next(err); }
});

// GET /api/books/:id
router.get("/:id", async (req, res, next) => {
  try {
    const book = await db.get("SELECT * FROM books WHERE id = ?", [req.params.id]);
    if (!book) return res.status(404).json({ error: "Book not found" });
    res.json(book);
  } catch (err) { next(err); }
});

// POST /api/books
router.post("/", async (req, res, next) => {
  try {
    const { title, author, isbn, category = "General", total_copies = 1, publisher, year } = req.body;
    if (!title || !author)
      return res.status(400).json({ error: "title and author are required" });

    const result = await db.run(
      `INSERT INTO books (title, author, isbn, category, total_copies, available, publisher, year)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, author, isbn || null, category, total_copies, total_copies, publisher || null, year || null]
    );
    res.status(201).json(await db.get("SELECT * FROM books WHERE id = ?", [result.lastID]));
  } catch (err) {
    if (err.message?.includes("UNIQUE")) return res.status(409).json({ error: "ISBN already exists" });
    next(err);
  }
});

// PUT /api/books/:id
router.put("/:id", async (req, res, next) => {
  try {
    const book = await db.get("SELECT * FROM books WHERE id = ?", [req.params.id]);
    if (!book) return res.status(404).json({ error: "Book not found" });

    const { title, author, isbn, category, total_copies, publisher, year } = req.body;
    const borrowed    = book.total_copies - book.available;
    const newTotal    = total_copies !== undefined ? Number(total_copies) : book.total_copies;
    const newAvailable = Math.max(0, newTotal - borrowed);

    await db.run(
      `UPDATE books SET title=?, author=?, isbn=?, category=?, total_copies=?, available=?, publisher=?, year=?
       WHERE id=?`,
      [
        title       ?? book.title,
        author      ?? book.author,
        isbn        !== undefined ? isbn        : book.isbn,
        category    ?? book.category,
        newTotal,
        newAvailable,
        publisher   !== undefined ? publisher   : book.publisher,
        year        !== undefined ? year        : book.year,
        req.params.id,
      ]
    );
    res.json(await db.get("SELECT * FROM books WHERE id = ?", [req.params.id]));
  } catch (err) { next(err); }
});

// DELETE /api/books/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const book = await db.get("SELECT * FROM books WHERE id = ?", [req.params.id]);
    if (!book) return res.status(404).json({ error: "Book not found" });

    const active = await db.get(
      "SELECT id FROM borrows WHERE book_id = ? AND status = 'borrowed' LIMIT 1",
      [req.params.id]
    );
    if (active) return res.status(400).json({ error: "Cannot delete book with active borrows" });

    await db.run("DELETE FROM books WHERE id = ?", [req.params.id]);
    res.json({ message: "Book deleted" });
  } catch (err) { next(err); }
});

module.exports = router;

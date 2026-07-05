const express = require("express");
const db = require("../database");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

// GET /api/books  — list all with optional search
router.get("/", (req, res) => {
  const { search, category } = req.query;
  let query = "SELECT * FROM books WHERE 1=1";
  const params = [];

  if (search) {
    query += " AND (title LIKE ? OR author LIKE ? OR isbn LIKE ?)";
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (category) {
    query += " AND category = ?";
    params.push(category);
  }

  query += " ORDER BY title ASC";
  res.json(db.prepare(query).all(...params));
});

// GET /api/books/:id
router.get("/:id", (req, res) => {
  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(req.params.id);
  if (!book) return res.status(404).json({ error: "Book not found" });
  res.json(book);
});

// POST /api/books
router.post("/", (req, res) => {
  const { title, author, isbn, category = "General", total_copies = 1, publisher, year } = req.body;
  if (!title || !author)
    return res.status(400).json({ error: "title and author are required" });

  try {
    const result = db
      .prepare(
        `INSERT INTO books (title, author, isbn, category, total_copies, available, publisher, year)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(title, author, isbn || null, category, total_copies, total_copies, publisher || null, year || null);

    res.status(201).json(db.prepare("SELECT * FROM books WHERE id = ?").get(result.lastInsertRowid));
  } catch (e) {
    if (e.message.includes("UNIQUE")) return res.status(409).json({ error: "ISBN already exists" });
    throw e;
  }
});

// PUT /api/books/:id
router.put("/:id", (req, res) => {
  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(req.params.id);
  if (!book) return res.status(404).json({ error: "Book not found" });

  const { title, author, isbn, category, total_copies, publisher, year } = req.body;

  // Recalculate available when total_copies changes
  const borrowed = book.total_copies - book.available;
  const newTotal = total_copies !== undefined ? total_copies : book.total_copies;
  const newAvailable = Math.max(0, newTotal - borrowed);

  db.prepare(
    `UPDATE books SET title=?, author=?, isbn=?, category=?, total_copies=?, available=?, publisher=?, year=?
     WHERE id=?`
  ).run(
    title ?? book.title,
    author ?? book.author,
    isbn !== undefined ? isbn : book.isbn,
    category ?? book.category,
    newTotal,
    newAvailable,
    publisher !== undefined ? publisher : book.publisher,
    year !== undefined ? year : book.year,
    req.params.id
  );

  res.json(db.prepare("SELECT * FROM books WHERE id = ?").get(req.params.id));
});

// DELETE /api/books/:id
router.delete("/:id", (req, res) => {
  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(req.params.id);
  if (!book) return res.status(404).json({ error: "Book not found" });

  const activeBorrow = db
    .prepare("SELECT id FROM borrows WHERE book_id = ? AND status = 'borrowed' LIMIT 1")
    .get(req.params.id);
  if (activeBorrow)
    return res.status(400).json({ error: "Cannot delete book with active borrows" });

  db.prepare("DELETE FROM books WHERE id = ?").run(req.params.id);
  res.json({ message: "Book deleted" });
});

// GET /api/books/meta/categories
router.get("/meta/categories", (req, res) => {
  const rows = db.prepare("SELECT DISTINCT category FROM books ORDER BY category").all();
  res.json(rows.map((r) => r.category));
});

module.exports = router;

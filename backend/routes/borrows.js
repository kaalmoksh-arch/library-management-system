const express = require("express");
const db = require("../database");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

const FINE_PER_DAY = 5; // ₹5 per day overdue
const LOAN_DAYS = 14;   // default 2-week loan period

function daysOverdue(dueDate) {
  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diff = Math.floor((now - due) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

// GET /api/borrows  — list with filters
router.get("/", (req, res) => {
  const { status, member_id, book_id } = req.query;
  let query = `
    SELECT bw.*,
           bk.title  AS book_title,
           bk.author AS book_author,
           bk.isbn   AS book_isbn,
           m.name    AS member_name,
           m.member_id AS member_code
    FROM borrows bw
    JOIN books   bk ON bk.id = bw.book_id
    JOIN members m  ON m.id  = bw.member_id
    WHERE 1=1
  `;
  const params = [];

  if (status)    { query += " AND bw.status = ?";    params.push(status); }
  if (member_id) { query += " AND bw.member_id = ?"; params.push(member_id); }
  if (book_id)   { query += " AND bw.book_id = ?";   params.push(book_id); }

  query += " ORDER BY bw.borrow_date DESC";
  res.json(db.prepare(query).all(...params));
});

// GET /api/borrows/overdue  — convenience endpoint
router.get("/overdue", (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const rows = db.prepare(`
    SELECT bw.*,
           bk.title AS book_title,
           m.name   AS member_name,
           m.member_id AS member_code
    FROM borrows bw
    JOIN books   bk ON bk.id = bw.book_id
    JOIN members m  ON m.id  = bw.member_id
    WHERE bw.status = 'borrowed' AND bw.due_date < ?
    ORDER BY bw.due_date ASC
  `).all(today);
  res.json(rows);
});

// POST /api/borrows  — issue a book
router.post("/", (req, res) => {
  const { book_id, member_id, loan_days } = req.body;
  if (!book_id || !member_id)
    return res.status(400).json({ error: "book_id and member_id are required" });

  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(book_id);
  if (!book) return res.status(404).json({ error: "Book not found" });
  if (book.available < 1) return res.status(400).json({ error: "No copies available" });

  const member = db.prepare("SELECT * FROM members WHERE id = ?").get(member_id);
  if (!member) return res.status(404).json({ error: "Member not found" });
  if (member.status === "suspended")
    return res.status(400).json({ error: "Member account is suspended" });

  // Check if member already borrowed this book and not returned
  const existing = db
    .prepare("SELECT id FROM borrows WHERE book_id=? AND member_id=? AND status='borrowed' LIMIT 1")
    .get(book_id, member_id);
  if (existing) return res.status(400).json({ error: "Member already has this book borrowed" });

  const today = new Date().toISOString().split("T")[0];
  const due = addDays(today, loan_days || LOAN_DAYS);

  const result = db
    .prepare("INSERT INTO borrows (book_id, member_id, due_date) VALUES (?, ?, ?)")
    .run(book_id, member_id, due);

  // Decrease available count
  db.prepare("UPDATE books SET available = available - 1 WHERE id = ?").run(book_id);

  const borrow = db.prepare(`
    SELECT bw.*, bk.title AS book_title, m.name AS member_name
    FROM borrows bw
    JOIN books bk ON bk.id = bw.book_id
    JOIN members m ON m.id = bw.member_id
    WHERE bw.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(borrow);
});

// PUT /api/borrows/:id/return  — return a book
router.put("/:id/return", (req, res) => {
  const borrow = db.prepare("SELECT * FROM borrows WHERE id = ?").get(req.params.id);
  if (!borrow) return res.status(404).json({ error: "Borrow record not found" });
  if (borrow.status === "returned")
    return res.status(400).json({ error: "Book already returned" });

  const today = new Date().toISOString().split("T")[0];
  const overdueDays = daysOverdue(borrow.due_date);
  const fine = overdueDays * FINE_PER_DAY;

  db.prepare(
    "UPDATE borrows SET status='returned', return_date=?, fine=? WHERE id=?"
  ).run(today, fine, req.params.id);

  // Increase available count
  db.prepare("UPDATE books SET available = available + 1 WHERE id = ?").run(borrow.book_id);

  const updated = db.prepare(`
    SELECT bw.*, bk.title AS book_title, m.name AS member_name
    FROM borrows bw
    JOIN books bk ON bk.id = bw.book_id
    JOIN members m ON m.id = bw.member_id
    WHERE bw.id = ?
  `).get(req.params.id);

  res.json({ ...updated, overdue_days: overdueDays });
});

// GET /api/borrows/stats  — dashboard summary
router.get("/stats", (req, res) => {
  const totalBooks    = db.prepare("SELECT COUNT(*) AS n FROM books").get().n;
  const totalMembers  = db.prepare("SELECT COUNT(*) AS n FROM members").get().n;
  const activeBorrows = db.prepare("SELECT COUNT(*) AS n FROM borrows WHERE status='borrowed'").get().n;
  const today         = new Date().toISOString().split("T")[0];
  const overdueCount  = db.prepare("SELECT COUNT(*) AS n FROM borrows WHERE status='borrowed' AND due_date < ?").get(today).n;
  const totalFines    = db.prepare("SELECT COALESCE(SUM(fine),0) AS n FROM borrows").get().n;
  const recentBorrows = db.prepare(`
    SELECT bw.id, bk.title, m.name AS member_name, bw.borrow_date, bw.due_date, bw.status
    FROM borrows bw
    JOIN books bk ON bk.id = bw.book_id
    JOIN members m ON m.id = bw.member_id
    ORDER BY bw.borrow_date DESC LIMIT 5
  `).all();

  res.json({ totalBooks, totalMembers, activeBorrows, overdueCount, totalFines, recentBorrows });
});

module.exports = router;

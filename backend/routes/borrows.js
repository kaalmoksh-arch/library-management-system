const express = require("express");
const db      = require("../database");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

const FINE_PER_DAY = 5;
const LOAN_DAYS    = 14;

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

// GET /api/borrows/stats  — must be before /:id
router.get("/stats", async (req, res, next) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const [totalBooks, totalMembers, activeBorrows, overdueRow, finesRow, recentBorrows] =
      await Promise.all([
        db.get("SELECT COUNT(*) AS n FROM books"),
        db.get("SELECT COUNT(*) AS n FROM members"),
        db.get("SELECT COUNT(*) AS n FROM borrows WHERE status='borrowed'"),
        db.get("SELECT COUNT(*) AS n FROM borrows WHERE status='borrowed' AND due_date < ?", [today]),
        db.get("SELECT COALESCE(SUM(fine),0) AS n FROM borrows"),
        db.all(`
          SELECT bw.id, bk.title, m.name AS member_name, bw.borrow_date, bw.due_date, bw.status
          FROM borrows bw
          JOIN books   bk ON bk.id = bw.book_id
          JOIN members m  ON m.id  = bw.member_id
          ORDER BY bw.borrow_date DESC LIMIT 5
        `),
      ]);

    res.json({
      totalBooks:    totalBooks.n,
      totalMembers:  totalMembers.n,
      activeBorrows: activeBorrows.n,
      overdueCount:  overdueRow.n,
      totalFines:    finesRow.n,
      recentBorrows,
    });
  } catch (err) { next(err); }
});

// GET /api/borrows/overdue
router.get("/overdue", async (req, res, next) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const rows = await db.all(
      `SELECT bw.*, bk.title AS book_title, m.name AS member_name, m.member_id AS member_code
       FROM borrows bw
       JOIN books   bk ON bk.id = bw.book_id
       JOIN members m  ON m.id  = bw.member_id
       WHERE bw.status = 'borrowed' AND bw.due_date < ?
       ORDER BY bw.due_date ASC`,
      [today]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/borrows
router.get("/", async (req, res, next) => {
  try {
    const { status, member_id, book_id } = req.query;
    let sql = `
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
    if (status)    { sql += " AND bw.status = ?";    params.push(status); }
    if (member_id) { sql += " AND bw.member_id = ?"; params.push(member_id); }
    if (book_id)   { sql += " AND bw.book_id = ?";   params.push(book_id); }
    sql += " ORDER BY bw.borrow_date DESC";

    res.json(await db.all(sql, params));
  } catch (err) { next(err); }
});

// POST /api/borrows  — issue a book
router.post("/", async (req, res, next) => {
  try {
    const { book_id, member_id, loan_days } = req.body;
    if (!book_id || !member_id)
      return res.status(400).json({ error: "book_id and member_id are required" });

    const book   = await db.get("SELECT * FROM books WHERE id = ?",   [book_id]);
    const member = await db.get("SELECT * FROM members WHERE id = ?", [member_id]);

    if (!book)   return res.status(404).json({ error: "Book not found" });
    if (!member) return res.status(404).json({ error: "Member not found" });
    if (book.available < 1)           return res.status(400).json({ error: "No copies available" });
    if (member.status === "suspended") return res.status(400).json({ error: "Member account is suspended" });

    const existing = await db.get(
      "SELECT id FROM borrows WHERE book_id=? AND member_id=? AND status='borrowed' LIMIT 1",
      [book_id, member_id]
    );
    if (existing) return res.status(400).json({ error: "Member already has this book borrowed" });

    const today = new Date().toISOString().split("T")[0];
    const due   = addDays(today, loan_days || LOAN_DAYS);

    const result = await db.run(
      "INSERT INTO borrows (book_id, member_id, due_date) VALUES (?, ?, ?)",
      [book_id, member_id, due]
    );
    await db.run("UPDATE books SET available = available - 1 WHERE id = ?", [book_id]);

    const borrow = await db.get(
      `SELECT bw.*, bk.title AS book_title, m.name AS member_name
       FROM borrows bw
       JOIN books bk ON bk.id = bw.book_id
       JOIN members m ON m.id = bw.member_id
       WHERE bw.id = ?`,
      [result.lastID]
    );
    res.status(201).json(borrow);
  } catch (err) { next(err); }
});

// PUT /api/borrows/:id/return
router.put("/:id/return", async (req, res, next) => {
  try {
    const borrow = await db.get("SELECT * FROM borrows WHERE id = ?", [req.params.id]);
    if (!borrow) return res.status(404).json({ error: "Borrow record not found" });
    if (borrow.status === "returned") return res.status(400).json({ error: "Book already returned" });

    const today       = new Date().toISOString().split("T")[0];
    const overdueDays = daysOverdue(borrow.due_date);
    const fine        = overdueDays * FINE_PER_DAY;

    await db.run(
      "UPDATE borrows SET status='returned', return_date=?, fine=? WHERE id=?",
      [today, fine, req.params.id]
    );
    await db.run("UPDATE books SET available = available + 1 WHERE id = ?", [borrow.book_id]);

    const updated = await db.get(
      `SELECT bw.*, bk.title AS book_title, m.name AS member_name
       FROM borrows bw
       JOIN books bk ON bk.id = bw.book_id
       JOIN members m ON m.id = bw.member_id
       WHERE bw.id = ?`,
      [req.params.id]
    );
    res.json({ ...updated, overdue_days: overdueDays });
  } catch (err) { next(err); }
});

module.exports = router;

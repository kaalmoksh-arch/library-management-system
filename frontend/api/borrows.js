const jwt = require("jsonwebtoken");
const { query, initDB } = require("./db");

const SECRET       = process.env.JWT_SECRET || "library_secret_key";
const FINE_PER_DAY = 5;
const LOAN_DAYS    = 14;

function authUser(req) {
  try { return jwt.verify((req.headers.authorization||"").replace("Bearer ",""), SECRET); }
  catch { return null; }
}
function daysOverdue(d) {
  const due = new Date(d), now = new Date();
  now.setHours(0,0,0,0); due.setHours(0,0,0,0);
  const diff = Math.floor((now-due)/86400000);
  return diff > 0 ? diff : 0;
}
function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!authUser(req)) return res.status(401).json({ error: "Unauthorized" });

  try {
    await initDB();
  } catch (e) {
    return res.status(500).json({ error: "DB init failed: " + e.message });
  }

  // sub = everything after /api/borrows/  e.g. "stats", "overdue", "42/return"
  const sub    = (req.query.sub || "").replace(/^\//, "").split("?")[0];
  const parts  = sub.split("/").filter(Boolean);
  const first  = parts[0] || "";
  const second = parts[1] || "";
  const id     = !isNaN(first) && first !== "" ? first : null;
  const isReturn  = id && second === "return";

  try {
    // GET /api/borrows/stats
    if (req.method === "GET" && first === "stats") {
      const [
        { rows: [{ n: totalBooks }] },
        { rows: [{ n: totalMembers }] },
        { rows: [{ n: activeBorrows }] },
        { rows: [{ n: overdueCount }] },
        { rows: [{ n: totalFines }] },
        { rows: recentBorrows },
      ] = await Promise.all([
        query("SELECT COUNT(*)::int AS n FROM books"),
        query("SELECT COUNT(*)::int AS n FROM members"),
        query("SELECT COUNT(*)::int AS n FROM borrows WHERE status='borrowed'"),
        query("SELECT COUNT(*)::int AS n FROM borrows WHERE status='borrowed' AND due_date < CURRENT_DATE"),
        query("SELECT COALESCE(SUM(fine),0) AS n FROM borrows"),
        query(`SELECT bw.id, bk.title, m.name AS member_name,
                      bw.borrow_date, bw.due_date, bw.status
               FROM borrows bw
               JOIN books bk ON bk.id=bw.book_id
               JOIN members m ON m.id=bw.member_id
               ORDER BY bw.borrow_date DESC LIMIT 5`),
      ]);
      return res.json({ totalBooks, totalMembers, activeBorrows, overdueCount,
                        totalFines: Number(totalFines), recentBorrows });
    }

    // GET /api/borrows/overdue
    if (req.method === "GET" && first === "overdue") {
      const { rows } = await query(`
        SELECT bw.*, bk.title AS book_title,
               m.name AS member_name, m.member_id AS member_code
        FROM borrows bw
        JOIN books   bk ON bk.id=bw.book_id
        JOIN members m  ON m.id=bw.member_id
        WHERE bw.status='borrowed' AND bw.due_date < CURRENT_DATE
        ORDER BY bw.due_date ASC`);
      return res.json(rows);
    }

    // GET /api/borrows
    if (req.method === "GET") {
      const { status, member_id, book_id } = req.query;
      const params = [];
      let where = "WHERE 1=1";
      if (status)    { params.push(status);    where += ` AND bw.status=$${params.length}`; }
      if (member_id) { params.push(member_id); where += ` AND bw.member_id=$${params.length}`; }
      if (book_id)   { params.push(book_id);   where += ` AND bw.book_id=$${params.length}`; }
      const { rows } = await query(`
        SELECT bw.*, bk.title AS book_title, bk.author AS book_author,
               bk.isbn AS book_isbn, m.name AS member_name, m.member_id AS member_code
        FROM borrows bw
        JOIN books   bk ON bk.id=bw.book_id
        JOIN members m  ON m.id=bw.member_id
        ${where} ORDER BY bw.borrow_date DESC`, params);
      return res.json(rows);
    }

    // POST /api/borrows
    if (req.method === "POST") {
      const { book_id, member_id, loan_days } = req.body;
      if (!book_id || !member_id)
        return res.status(400).json({ error: "book_id and member_id required" });
      const { rows: [book] }   = await query("SELECT * FROM books WHERE id=$1",   [book_id]);
      const { rows: [member] } = await query("SELECT * FROM members WHERE id=$1", [member_id]);
      if (!book)   return res.status(404).json({ error: "Book not found" });
      if (!member) return res.status(404).json({ error: "Member not found" });
      if (book.available < 1)            return res.status(400).json({ error: "No copies available" });
      if (member.status === "suspended") return res.status(400).json({ error: "Member suspended" });
      const { rows: [ex] } = await query(
        "SELECT id FROM borrows WHERE book_id=$1 AND member_id=$2 AND status='borrowed' LIMIT 1",
        [book_id, member_id]
      );
      if (ex) return res.status(400).json({ error: "Member already has this book" });
      const due = addDays(loan_days || LOAN_DAYS);
      const { rows: [b] } = await query(
        "INSERT INTO borrows (book_id,member_id,due_date) VALUES ($1,$2,$3) RETURNING id",
        [book_id, member_id, due]
      );
      await query("UPDATE books SET available=available-1 WHERE id=$1", [book_id]);
      const { rows: [result] } = await query(`
        SELECT bw.*, bk.title AS book_title, m.name AS member_name
        FROM borrows bw JOIN books bk ON bk.id=bw.book_id JOIN members m ON m.id=bw.member_id
        WHERE bw.id=$1`, [b.id]);
      return res.status(201).json(result);
    }

    // PUT /api/borrows/:id/return
    if (req.method === "PUT" && isReturn) {
      const { rows: [borrow] } = await query("SELECT * FROM borrows WHERE id=$1", [id]);
      if (!borrow) return res.status(404).json({ error: "Borrow not found" });
      if (borrow.status === "returned") return res.status(400).json({ error: "Already returned" });
      const overdueDays = daysOverdue(borrow.due_date);
      const fine        = overdueDays * FINE_PER_DAY;
      const today       = new Date().toISOString().split("T")[0];
      await query("UPDATE borrows SET status='returned',return_date=$1,fine=$2 WHERE id=$3",
        [today, fine, id]);
      await query("UPDATE books SET available=available+1 WHERE id=$1", [borrow.book_id]);
      const { rows: [updated] } = await query(`
        SELECT bw.*, bk.title AS book_title, m.name AS member_name
        FROM borrows bw JOIN books bk ON bk.id=bw.book_id JOIN members m ON m.id=bw.member_id
        WHERE bw.id=$1`, [id]);
      return res.json({ ...updated, overdue_days: overdueDays });
    }

    return res.status(404).json({ error: "Not found" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
};

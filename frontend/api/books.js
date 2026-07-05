const jwt = require("jsonwebtoken");
const { query, initDB } = require("./db");

const SECRET = process.env.JWT_SECRET || "library_secret_key";

function authUser(req) {
  try { return jwt.verify((req.headers.authorization||"").replace("Bearer ",""), SECRET); }
  catch { return null; }
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!authUser(req)) return res.status(401).json({ error: "Unauthorized" });

  try {
    await initDB();
  } catch (e) {
    return res.status(500).json({ error: "DB init failed: " + e.message });
  }

  // sub = everything after /api/books/  e.g. "42", "meta/categories", "42" for DELETE
  const sub   = (req.query.sub || "").replace(/^\//, "").split("?")[0];
  const parts = sub.split("/").filter(Boolean);
  const id    = parts[0] && !isNaN(parts[0]) ? parts[0] : null;
  const isMeta = parts[0] === "meta" && parts[1] === "categories";

  try {
    // GET /api/books/meta/categories
    if (req.method === "GET" && isMeta) {
      const { rows } = await query("SELECT DISTINCT category FROM books ORDER BY category");
      return res.json(rows.map(r => r.category));
    }

    // GET /api/books/:id
    if (req.method === "GET" && id) {
      const { rows } = await query("SELECT * FROM books WHERE id=$1", [id]);
      if (!rows[0]) return res.status(404).json({ error: "Book not found" });
      return res.json(rows[0]);
    }

    // GET /api/books
    if (req.method === "GET") {
      const { search, category } = req.query;
      const params = [];
      let where = "WHERE 1=1";
      if (search) {
        params.push(`%${search}%`);
        where += ` AND (title ILIKE $${params.length} OR author ILIKE $${params.length} OR isbn ILIKE $${params.length})`;
      }
      if (category) { params.push(category); where += ` AND category=$${params.length}`; }
      const { rows } = await query(`SELECT * FROM books ${where} ORDER BY title`, params);
      return res.json(rows);
    }

    // POST /api/books
    if (req.method === "POST" && !id) {
      const { title, author, isbn, category="General", total_copies=1, publisher, year } = req.body;
      if (!title || !author) return res.status(400).json({ error: "title and author required" });
      try {
        const { rows } = await query(
          `INSERT INTO books (title,author,isbn,category,total_copies,available,publisher,year)
           VALUES ($1,$2,$3,$4,$5,$5,$6,$7) RETURNING *`,
          [title, author, isbn||null, category, Number(total_copies), publisher||null, year||null]
        );
        return res.status(201).json(rows[0]);
      } catch (e) {
        if (e.code === "23505") return res.status(409).json({ error: "ISBN exists" });
        throw e;
      }
    }

    // PUT /api/books/:id
    if (req.method === "PUT" && id) {
      const { rows: ex } = await query("SELECT * FROM books WHERE id=$1", [id]);
      if (!ex[0]) return res.status(404).json({ error: "Book not found" });
      const book = ex[0];
      const { title, author, isbn, category, total_copies, publisher, year } = req.body;
      const borrowed = book.total_copies - book.available;
      const newTotal = total_copies !== undefined ? Number(total_copies) : book.total_copies;
      const newAvail = Math.max(0, newTotal - borrowed);
      const { rows } = await query(
        `UPDATE books SET title=$1,author=$2,isbn=$3,category=$4,
         total_copies=$5,available=$6,publisher=$7,year=$8 WHERE id=$9 RETURNING *`,
        [title??book.title, author??book.author,
         isbn!==undefined?isbn:book.isbn, category??book.category,
         newTotal, newAvail,
         publisher!==undefined?publisher:book.publisher,
         year!==undefined?year:book.year, id]
      );
      return res.json(rows[0]);
    }

    // DELETE /api/books/:id
    if (req.method === "DELETE" && id) {
      const { rows: active } = await query(
        "SELECT id FROM borrows WHERE book_id=$1 AND status='borrowed' LIMIT 1", [id]
      );
      if (active[0]) return res.status(400).json({ error: "Cannot delete book with active borrows" });
      await query("DELETE FROM books WHERE id=$1", [id]);
      return res.json({ message: "Book deleted" });
    }

    return res.status(404).json({ error: "Not found" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
};

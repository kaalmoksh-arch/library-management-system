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

  // sub = everything after /api/members/  e.g. "42", "42/borrows"
  const sub    = (req.query.sub || "").replace(/^\//, "").split("?")[0];
  const parts  = sub.split("/").filter(Boolean);
  const id     = parts[0] && !isNaN(parts[0]) ? parts[0] : null;
  const isBorrows = id && parts[1] === "borrows";

  try {
    // GET /api/members/:id/borrows
    if (req.method === "GET" && isBorrows) {
      const { rows } = await query(
        `SELECT b.*, bk.title, bk.author, bk.isbn
         FROM borrows b JOIN books bk ON bk.id=b.book_id
         WHERE b.member_id=$1 ORDER BY b.borrow_date DESC`,
        [id]
      );
      return res.json(rows);
    }

    // GET /api/members/:id
    if (req.method === "GET" && id) {
      const { rows } = await query("SELECT * FROM members WHERE id=$1", [id]);
      if (!rows[0]) return res.status(404).json({ error: "Member not found" });
      return res.json(rows[0]);
    }

    // GET /api/members
    if (req.method === "GET") {
      const { search, status } = req.query;
      const params = [];
      let where = "WHERE 1=1";
      if (search) {
        params.push(`%${search}%`);
        where += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length} OR member_id ILIKE $${params.length})`;
      }
      if (status) { params.push(status); where += ` AND status=$${params.length}`; }
      const { rows } = await query(`SELECT * FROM members ${where} ORDER BY name`, params);
      return res.json(rows);
    }

    // POST /api/members
    if (req.method === "POST" && !id) {
      const { name, email, phone, address } = req.body;
      if (!name || !email) return res.status(400).json({ error: "name and email required" });
      const { rows: last } = await query("SELECT id FROM members ORDER BY id DESC LIMIT 1");
      const num       = last[0] ? last[0].id + 1 : 1;
      const member_id = `LIB-${String(num).padStart(5, "0")}`;
      try {
        const { rows } = await query(
          "INSERT INTO members (name,email,phone,address,member_id) VALUES ($1,$2,$3,$4,$5) RETURNING *",
          [name, email, phone||null, address||null, member_id]
        );
        return res.status(201).json(rows[0]);
      } catch (e) {
        if (e.code === "23505") return res.status(409).json({ error: "Email already registered" });
        throw e;
      }
    }

    // PUT /api/members/:id
    if (req.method === "PUT" && id) {
      const { rows: ex } = await query("SELECT * FROM members WHERE id=$1", [id]);
      if (!ex[0]) return res.status(404).json({ error: "Member not found" });
      const m = ex[0];
      const { name, email, phone, address, status } = req.body;
      const { rows } = await query(
        "UPDATE members SET name=$1,email=$2,phone=$3,address=$4,status=$5 WHERE id=$6 RETURNING *",
        [name??m.name, email??m.email,
         phone!==undefined?phone:m.phone,
         address!==undefined?address:m.address,
         status??m.status, id]
      );
      return res.json(rows[0]);
    }

    // DELETE /api/members/:id
    if (req.method === "DELETE" && id) {
      const { rows: active } = await query(
        "SELECT id FROM borrows WHERE member_id=$1 AND status='borrowed' LIMIT 1", [id]
      );
      if (active[0]) return res.status(400).json({ error: "Cannot delete member with active borrows" });
      await query("DELETE FROM members WHERE id=$1", [id]);
      return res.json({ message: "Member deleted" });
    }

    return res.status(404).json({ error: "Not found" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
};

const express = require("express");
const { query } = require("../database");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

// GET /api/members
router.get("/", async (req, res, next) => {
  try {
    const { search, status } = req.query;
    const params = [];
    let where = "WHERE 1=1";

    if (search) {
      params.push(`%${search}%`);
      where += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length} OR member_id ILIKE $${params.length})`;
    }
    if (status) {
      params.push(status);
      where += ` AND status = $${params.length}`;
    }

    const { rows } = await query(`SELECT * FROM members ${where} ORDER BY name ASC`, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/members/:id
router.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await query("SELECT * FROM members WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Member not found" });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/members
router.post("/", async (req, res, next) => {
  try {
    const { name, email, phone, address } = req.body;
    if (!name || !email)
      return res.status(400).json({ error: "name and email are required" });

    // Generate member ID: LIB-00001
    const { rows: last } = await query("SELECT id FROM members ORDER BY id DESC LIMIT 1");
    const num       = last[0] ? last[0].id + 1 : 1;
    const member_id = `LIB-${String(num).padStart(5, "0")}`;

    const { rows } = await query(
      "INSERT INTO members (name, email, phone, address, member_id) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [name, email, phone || null, address || null, member_id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Email already registered" });
    next(err);
  }
});

// PUT /api/members/:id
router.put("/:id", async (req, res, next) => {
  try {
    const { rows: existing } = await query("SELECT * FROM members WHERE id = $1", [req.params.id]);
    const member = existing[0];
    if (!member) return res.status(404).json({ error: "Member not found" });

    const { name, email, phone, address, status } = req.body;
    const { rows } = await query(
      "UPDATE members SET name=$1, email=$2, phone=$3, address=$4, status=$5 WHERE id=$6 RETURNING *",
      [
        name    ?? member.name,
        email   ?? member.email,
        phone   !== undefined ? phone   : member.phone,
        address !== undefined ? address : member.address,
        status  ?? member.status,
        req.params.id,
      ]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/members/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const { rows: existing } = await query("SELECT * FROM members WHERE id = $1", [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: "Member not found" });

    const { rows: active } = await query(
      "SELECT id FROM borrows WHERE member_id = $1 AND status = 'borrowed' LIMIT 1",
      [req.params.id]
    );
    if (active[0]) return res.status(400).json({ error: "Cannot delete member with active borrows" });

    await query("DELETE FROM members WHERE id = $1", [req.params.id]);
    res.json({ message: "Member deleted" });
  } catch (err) { next(err); }
});

// GET /api/members/:id/borrows
router.get("/:id/borrows", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT b.*, bk.title, bk.author, bk.isbn
       FROM borrows b JOIN books bk ON bk.id = b.book_id
       WHERE b.member_id = $1 ORDER BY b.borrow_date DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;

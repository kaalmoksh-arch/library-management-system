const express = require("express");
const db      = require("../database");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

// GET /api/members
router.get("/", async (req, res, next) => {
  try {
    const { search, status } = req.query;
    let sql = "SELECT * FROM members WHERE 1=1";
    const params = [];

    if (search) {
      sql += " AND (name LIKE ? OR email LIKE ? OR member_id LIKE ?)";
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    if (status) { sql += " AND status = ?"; params.push(status); }
    sql += " ORDER BY name ASC";

    res.json(await db.all(sql, params));
  } catch (err) { next(err); }
});

// GET /api/members/:id
router.get("/:id", async (req, res, next) => {
  try {
    const member = await db.get("SELECT * FROM members WHERE id = ?", [req.params.id]);
    if (!member) return res.status(404).json({ error: "Member not found" });
    res.json(member);
  } catch (err) { next(err); }
});

// POST /api/members
router.post("/", async (req, res, next) => {
  try {
    const { name, email, phone, address } = req.body;
    if (!name || !email)
      return res.status(400).json({ error: "name and email are required" });

    // Generate member ID: LIB-00001
    const last = await db.get("SELECT id FROM members ORDER BY id DESC LIMIT 1");
    const num  = last ? last.id + 1 : 1;
    const member_id = `LIB-${String(num).padStart(5, "0")}`;

    const result = await db.run(
      "INSERT INTO members (name, email, phone, address, member_id) VALUES (?, ?, ?, ?, ?)",
      [name, email, phone || null, address || null, member_id]
    );
    res.status(201).json(await db.get("SELECT * FROM members WHERE id = ?", [result.lastID]));
  } catch (err) {
    if (err.message?.includes("UNIQUE")) return res.status(409).json({ error: "Email already registered" });
    next(err);
  }
});

// PUT /api/members/:id
router.put("/:id", async (req, res, next) => {
  try {
    const member = await db.get("SELECT * FROM members WHERE id = ?", [req.params.id]);
    if (!member) return res.status(404).json({ error: "Member not found" });

    const { name, email, phone, address, status } = req.body;
    await db.run(
      "UPDATE members SET name=?, email=?, phone=?, address=?, status=? WHERE id=?",
      [
        name    ?? member.name,
        email   ?? member.email,
        phone   !== undefined ? phone   : member.phone,
        address !== undefined ? address : member.address,
        status  ?? member.status,
        req.params.id,
      ]
    );
    res.json(await db.get("SELECT * FROM members WHERE id = ?", [req.params.id]));
  } catch (err) { next(err); }
});

// DELETE /api/members/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const member = await db.get("SELECT * FROM members WHERE id = ?", [req.params.id]);
    if (!member) return res.status(404).json({ error: "Member not found" });

    const active = await db.get(
      "SELECT id FROM borrows WHERE member_id = ? AND status = 'borrowed' LIMIT 1",
      [req.params.id]
    );
    if (active) return res.status(400).json({ error: "Cannot delete member with active borrows" });

    await db.run("DELETE FROM members WHERE id = ?", [req.params.id]);
    res.json({ message: "Member deleted" });
  } catch (err) { next(err); }
});

// GET /api/members/:id/borrows
router.get("/:id/borrows", async (req, res, next) => {
  try {
    const rows = await db.all(
      `SELECT b.*, bk.title, bk.author, bk.isbn
       FROM borrows b
       JOIN books bk ON bk.id = b.book_id
       WHERE b.member_id = ?
       ORDER BY b.borrow_date DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;

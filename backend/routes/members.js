const express = require("express");
const db = require("../database");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

// Generate a unique member ID like LIB-00042
function generateMemberId() {
  const last = db.prepare("SELECT id FROM members ORDER BY id DESC LIMIT 1").get();
  const num = last ? last.id + 1 : 1;
  return `LIB-${String(num).padStart(5, "0")}`;
}

// GET /api/members
router.get("/", (req, res) => {
  const { search, status } = req.query;
  let query = "SELECT * FROM members WHERE 1=1";
  const params = [];

  if (search) {
    query += " AND (name LIKE ? OR email LIKE ? OR member_id LIKE ?)";
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (status) {
    query += " AND status = ?";
    params.push(status);
  }

  query += " ORDER BY name ASC";
  res.json(db.prepare(query).all(...params));
});

// GET /api/members/:id
router.get("/:id", (req, res) => {
  const member = db.prepare("SELECT * FROM members WHERE id = ?").get(req.params.id);
  if (!member) return res.status(404).json({ error: "Member not found" });
  res.json(member);
});

// POST /api/members
router.post("/", (req, res) => {
  const { name, email, phone, address } = req.body;
  if (!name || !email)
    return res.status(400).json({ error: "name and email are required" });

  const member_id = generateMemberId();

  try {
    const result = db
      .prepare(
        "INSERT INTO members (name, email, phone, address, member_id) VALUES (?, ?, ?, ?, ?)"
      )
      .run(name, email, phone || null, address || null, member_id);

    res.status(201).json(db.prepare("SELECT * FROM members WHERE id = ?").get(result.lastInsertRowid));
  } catch (e) {
    if (e.message.includes("UNIQUE")) return res.status(409).json({ error: "Email already registered" });
    throw e;
  }
});

// PUT /api/members/:id
router.put("/:id", (req, res) => {
  const member = db.prepare("SELECT * FROM members WHERE id = ?").get(req.params.id);
  if (!member) return res.status(404).json({ error: "Member not found" });

  const { name, email, phone, address, status } = req.body;

  db.prepare(
    "UPDATE members SET name=?, email=?, phone=?, address=?, status=? WHERE id=?"
  ).run(
    name ?? member.name,
    email ?? member.email,
    phone !== undefined ? phone : member.phone,
    address !== undefined ? address : member.address,
    status ?? member.status,
    req.params.id
  );

  res.json(db.prepare("SELECT * FROM members WHERE id = ?").get(req.params.id));
});

// DELETE /api/members/:id
router.delete("/:id", (req, res) => {
  const member = db.prepare("SELECT * FROM members WHERE id = ?").get(req.params.id);
  if (!member) return res.status(404).json({ error: "Member not found" });

  const activeBorrow = db
    .prepare("SELECT id FROM borrows WHERE member_id = ? AND status = 'borrowed' LIMIT 1")
    .get(req.params.id);
  if (activeBorrow)
    return res.status(400).json({ error: "Cannot delete member with active borrows" });

  db.prepare("DELETE FROM members WHERE id = ?").run(req.params.id);
  res.json({ message: "Member deleted" });
});

// GET /api/members/:id/borrows  — borrow history for a member
router.get("/:id/borrows", (req, res) => {
  const rows = db
    .prepare(
      `SELECT b.*, bk.title, bk.author, bk.isbn
       FROM borrows b
       JOIN books bk ON bk.id = b.book_id
       WHERE b.member_id = ?
       ORDER BY b.borrow_date DESC`
    )
    .all(req.params.id);
  res.json(rows);
});

module.exports = router;

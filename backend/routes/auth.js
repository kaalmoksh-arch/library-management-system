const express = require("express");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const { query } = require("../database");
const { authenticate, adminOnly, SECRET } = require("../middleware/auth");

const router = express.Router();

// POST /api/auth/login
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required" });

    const { rows } = await query("SELECT * FROM users WHERE email = $1", [email]);
    const user = rows[0];
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      SECRET,
      { expiresIn: "8h" }
    );
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { next(err); }
});

// GET /api/auth/me
router.get("/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/register (admin only)
router.post("/register", authenticate, adminOnly, async (req, res, next) => {
  try {
    const { name, email, password, role = "librarian" } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "name, email, and password are required" });

    const hash = bcrypt.hashSync(password, 10);
    const { rows } = await query(
      "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id",
      [name, email, hash, role]
    );
    res.status(201).json({ id: rows[0].id, name, email, role });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Email already exists" });
    next(err);
  }
});

module.exports = router;

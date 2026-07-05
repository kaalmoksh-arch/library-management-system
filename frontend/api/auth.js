const bcrypt = require("bcryptjs");
const jwt    = require("jsonwebtoken");
const { query, initDB } = require("./db");

const SECRET = process.env.JWT_SECRET || "library_secret_key";

function verify(token) {
  try { return jwt.verify(token, SECRET); } catch { return null; }
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    await initDB();
  } catch (e) {
    return res.status(500).json({ error: "DB init failed: " + e.message });
  }

  // sub = the part after /api/auth/  e.g. "login", "me", "register"
  const sub = (req.query.sub || "").replace(/^\//, "").split("?")[0].toLowerCase();

  // POST /api/auth/login
  if (req.method === "POST" && sub === "login") {
    try {
      const { email, password } = req.body;
      if (!email || !password)
        return res.status(400).json({ error: "Email and password required" });
      const { rows } = await query("SELECT * FROM users WHERE email=$1", [email]);
      const user = rows[0];
      if (!user || !bcrypt.compareSync(password, user.password))
        return res.status(401).json({ error: "Invalid credentials" });
      const token = jwt.sign(
        { id: user.id, name: user.name, email: user.email, role: user.role },
        SECRET, { expiresIn: "8h" }
      );
      return res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // GET /api/auth/me
  if (req.method === "GET" && sub === "me") {
    const user = verify((req.headers.authorization || "").replace("Bearer ", ""));
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    return res.json({ user });
  }

  // POST /api/auth/register
  if (req.method === "POST" && sub === "register") {
    try {
      const caller = verify((req.headers.authorization || "").replace("Bearer ", ""));
      if (!caller || caller.role !== "admin")
        return res.status(403).json({ error: "Admin only" });
      const { name, email, password, role = "librarian" } = req.body;
      if (!name || !email || !password)
        return res.status(400).json({ error: "name, email, password required" });
      const hash = bcrypt.hashSync(password, 10);
      const { rows } = await query(
        "INSERT INTO users (name,email,password,role) VALUES ($1,$2,$3,$4) RETURNING id",
        [name, email, hash, role]
      );
      return res.status(201).json({ id: rows[0].id, name, email, role });
    } catch (e) {
      if (e.code === "23505") return res.status(409).json({ error: "Email exists" });
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(404).json({ error: "Not found", sub });
};

/**
 * Seed script — run once to populate sample data
 * Usage:  node seed.js
 */
require("dotenv").config();
const { query, pool } = require("./database");

const books = [
  { title: "The Great Gatsby",           author: "F. Scott Fitzgerald", isbn: "9780743273565", category: "Fiction",      total_copies: 3, publisher: "Scribner",            year: 1925 },
  { title: "To Kill a Mockingbird",       author: "Harper Lee",          isbn: "9780061935466", category: "Fiction",      total_copies: 4, publisher: "HarperCollins",       year: 1960 },
  { title: "1984",                        author: "George Orwell",       isbn: "9780451524935", category: "Dystopian",    total_copies: 5, publisher: "Signet Classic",      year: 1949 },
  { title: "A Brief History of Time",     author: "Stephen Hawking",     isbn: "9780553380163", category: "Science",      total_copies: 2, publisher: "Bantam Books",        year: 1988 },
  { title: "The Alchemist",               author: "Paulo Coelho",        isbn: "9780062315007", category: "Fiction",      total_copies: 4, publisher: "HarperOne",           year: 1988 },
  { title: "Clean Code",                  author: "Robert C. Martin",    isbn: "9780132350884", category: "Technology",   total_copies: 3, publisher: "Prentice Hall",       year: 2008 },
  { title: "Introduction to Algorithms", author: "Thomas H. Cormen",    isbn: "9780262033848", category: "Technology",   total_copies: 2, publisher: "MIT Press",           year: 2009 },
  { title: "Sapiens",                     author: "Yuval Noah Harari",   isbn: "9780062316097", category: "History",      total_copies: 3, publisher: "Harper Perennial",    year: 2011 },
  { title: "Atomic Habits",               author: "James Clear",         isbn: "9780735211292", category: "Self-Help",    total_copies: 4, publisher: "Avery",               year: 2018 },
  { title: "The Pragmatic Programmer",    author: "David Thomas",        isbn: "9780135957059", category: "Technology",   total_copies: 2, publisher: "Addison-Wesley",      year: 2019 },
  { title: "Pride and Prejudice",         author: "Jane Austen",         isbn: "9780141439518", category: "Classic",      total_copies: 3, publisher: "Penguin Classics",    year: 1813 },
  { title: "The Lean Startup",            author: "Eric Ries",           isbn: "9780307887894", category: "Business",     total_copies: 2, publisher: "Crown Business",      year: 2011 },
  { title: "Thinking, Fast and Slow",     author: "Daniel Kahneman",     isbn: "9780374533557", category: "Psychology",   total_copies: 2, publisher: "Farrar, Straus",      year: 2011 },
  { title: "The Hitchhiker's Guide",      author: "Douglas Adams",       isbn: "9780345391803", category: "Sci-Fi",       total_copies: 3, publisher: "Del Rey",             year: 1979 },
  { title: "Dune",                        author: "Frank Herbert",       isbn: "9780441013593", category: "Sci-Fi",       total_copies: 2, publisher: "Ace Books",           year: 1965 },
];

const members = [
  { name: "Alice Johnson",  email: "alice@university.edu",   phone: "9876543210", address: "Hostel Block A, Room 101" },
  { name: "Bob Smith",      email: "bob@university.edu",     phone: "9876543211", address: "Hostel Block B, Room 204" },
  { name: "Carol Williams", email: "carol@university.edu",   phone: "9876543212", address: "Faculty Quarters, #12"   },
  { name: "David Brown",    email: "david@university.edu",   phone: "9876543213", address: "Hostel Block C, Room 305" },
  { name: "Eva Martinez",   email: "eva@university.edu",     phone: "9876543214", address: "Hostel Block A, Room 202" },
];

async function seed() {
  console.log("Seeding books...");
  for (const b of books) {
    try {
      await query(
        `INSERT INTO books (title, author, isbn, category, total_copies, available, publisher, year)
         VALUES ($1,$2,$3,$4,$5,$5,$6,$7)
         ON CONFLICT (isbn) DO NOTHING`,
        [b.title, b.author, b.isbn, b.category, b.total_copies, b.publisher, b.year]
      );
      console.log(`  ✓ ${b.title}`);
    } catch (e) {
      console.log(`  ✗ ${b.title}: ${e.message}`);
    }
  }

  console.log("\nSeeding members...");
  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    const member_id = `LIB-${String(i + 1).padStart(5, "0")}`;
    try {
      await query(
        `INSERT INTO members (name, email, phone, address, member_id)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (email) DO NOTHING`,
        [m.name, m.email, m.phone, m.address, member_id]
      );
      console.log(`  ✓ ${m.name} (${member_id})`);
    } catch (e) {
      console.log(`  ✗ ${m.name}: ${e.message}`);
    }
  }

  console.log("\nDone! Summary:");
  const { rows: [bc] } = await query("SELECT COUNT(*) AS n FROM books");
  const { rows: [mc] } = await query("SELECT COUNT(*) AS n FROM members");
  console.log(`  Books:   ${bc.n}`);
  console.log(`  Members: ${mc.n}`);

  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});

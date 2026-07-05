# 📚 University Library Management System

A full-stack web application for managing a university library — books, members, borrowing, returns, overdue tracking, and fines.

Built with **React + Vite + Tailwind CSS** (frontend) and **Node.js + Express + SQLite** (backend).

---

## Features

| Feature | Details |
|---|---|
| **Authentication** | JWT-based login, role-based access (Admin / Librarian) |
| **Books** | Add, edit, delete, search, filter by category |
| **Members** | Register members with auto-generated IDs, view borrow history |
| **Issue / Return** | Issue books to members, return with automatic fine calculation |
| **Overdue Tracking** | Dedicated overdue view with estimated fines (₹5/day) |
| **Dashboard** | Live stats with bar charts — books, members, borrows, overdue |
| **User Management** | Admin can create additional librarian/admin accounts |

---

## Project Structure

```
library-management-system/
├── backend/
│   ├── middleware/
│   │   └── auth.js          # JWT authentication middleware
│   ├── routes/
│   │   ├── auth.js          # Login, register, /me
│   │   ├── books.js         # Books CRUD + search
│   │   ├── members.js       # Members CRUD + borrow history
│   │   └── borrows.js       # Issue, return, overdue, stats
│   ├── database.js          # SQLite schema + seeding
│   ├── server.js            # Express app entry point
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── api/             # Axios instance with interceptors
    │   ├── components/      # Layout, Modal, Spinner, ConfirmDialog
    │   ├── context/         # AuthContext (JWT state)
    │   └── pages/           # Dashboard, Books, Members, Borrows, Overdue, Users
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    └── package.json
```

---

## Local Development Setup

### Prerequisites

- Node.js 18+ — https://nodejs.org
- npm 9+

### 1. Clone / open the project

```bash
cd library-management-system
```

### 2. Setup the Backend

```bash
cd backend
npm install
copy .env.example .env
```

Edit `.env`:

```env
PORT=5000
JWT_SECRET=any_long_random_string_here
FRONTEND_URL=http://localhost:3000
```

Start the backend:

```bash
npm run dev
```

The API runs at `http://localhost:5000`. The SQLite database (`library.db`) is created automatically on first run.

**Default admin account:**
- Email: `admin@library.com`
- Password: `admin123`

### 3. Setup the Frontend

Open a new terminal:

```bash
cd frontend
npm install
copy .env.example .env
```

The default `.env` points to `http://localhost:5000/api` — no change needed for local dev (Vite proxy handles it automatically).

Start the frontend:

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## Deployment (Free Hosting)

### Backend → Render (free tier)

1. Push the `backend/` folder to a GitHub repository
2. Go to https://render.com and sign up (free)
3. Click **New → Web Service**
4. Connect your GitHub repo
5. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Environment:** Node
6. Add environment variables:
   | Key | Value |
   |---|---|
   | `JWT_SECRET` | any long random string |
   | `FRONTEND_URL` | your Vercel URL (set after frontend deploy) |
   | `NODE_ENV` | `production` |
7. Click **Deploy** — you'll get a URL like `https://library-management-backend.onrender.com`

> **Note:** Render's free tier spins down after 15 minutes of inactivity. First request after sleep takes ~30s.

---

### Frontend → Vercel (free tier)

1. Push the `frontend/` folder to a GitHub repository
2. Go to https://vercel.com and sign up (free)
3. Click **New Project** → Import your repo
4. Set the **Framework Preset** to **Vite**
5. Add environment variable:
   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://your-backend.onrender.com/api` |
6. Click **Deploy** — you'll get a URL like `https://library-management.vercel.app`
7. Go back to Render and update `FRONTEND_URL` to your Vercel URL

---

### Alternative: Deploy Everything on Railway

Railway offers $5 free credit/month — enough for both services.

1. Go to https://railway.app and sign up
2. Create a **New Project**
3. Add two services: one from the `backend/` folder, one from `frontend/`
4. Set the same environment variables as above
5. Railway auto-detects Node.js and builds both

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/books` | List books (search, category filter) |
| POST | `/api/books` | Add a book |
| PUT | `/api/books/:id` | Update a book |
| DELETE | `/api/books/:id` | Delete a book |
| GET | `/api/members` | List members |
| POST | `/api/members` | Register a member |
| GET | `/api/members/:id/borrows` | Member's borrow history |
| GET | `/api/borrows` | List borrows (status filter) |
| POST | `/api/borrows` | Issue a book |
| PUT | `/api/borrows/:id/return` | Return a book |
| GET | `/api/borrows/overdue` | List overdue borrows |
| GET | `/api/borrows/stats` | Dashboard statistics |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Recharts |
| Routing | React Router v6 |
| HTTP Client | Axios |
| Backend | Node.js, Express 4 |
| Database | SQLite (via better-sqlite3) |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Hosting | Render (backend) + Vercel (frontend) |

---

## Screenshots

| Page | Description |
|---|---|
| Login | Clean login screen with default credentials hint |
| Dashboard | Stats cards + bar chart + recent borrows |
| Books | Searchable, filterable table with add/edit/delete |
| Members | Member list with borrow history drawer |
| Borrows | Issue books, return, fine tracking |
| Overdue | Red-highlighted overdue list with fine estimates |

---

## License

MIT — free to use for university projects.
# library-management-system

# ClearPath – University Digital Clearance & No-Dues Management System

EE4207 – Web Application Development · MERN stack (MongoDB, Express, React, Node.js)

Students submit one online clearance request. Every department (Library, Hostel, Finance, Labs, Sports, Student Affairs) reviews it in parallel, flags dues if needed, and once all departments clear the student, a PDF certificate with a QR code is issued. Anyone can verify the certificate on a public page.

---

## 1. What you need (one-time)

| Tool | Get it from |
| --- | --- |
| Node.js 18 or newer (LTS) | https://nodejs.org |
| A free MongoDB Atlas database | https://www.mongodb.com/cloud/atlas/register |
| VS Code (recommended) | https://code.visualstudio.com |
| Git + a GitHub account (for hosting) | https://git-scm.com |

### Create the MongoDB Atlas database (about 5 minutes)
1. Sign up → **Create** a free **M0** cluster.
2. **Database Access** → Add a database user (username + password). Remember them.
3. **Network Access** → Add IP Address → **Allow access from anywhere** (`0.0.0.0/0`).
4. **Connect** → Drivers → copy the connection string. It looks like
   `mongodb+srv://myuser:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
5. Replace `<password>` with your password and add the database name `clearpath` after `.net/`:
   `mongodb+srv://myuser:mypass@cluster0.xxxxx.mongodb.net/clearpath?retryWrites=true&w=majority`

---

## 2. Run it on your computer

> Updated the UI? Run `npm install` again inside `client` (new packages: framer-motion, lucide-react, react-hot-toast, recharts, canvas-confetti).

Open **two terminals** in VS Code (Terminal → New Terminal).

### Terminal 1 – backend API
```bash
cd server
npm install
copy .env.example .env        # on Mac/Linux: cp .env.example .env
```
Open `server/.env` and paste your Atlas string into `MONGO_URI`, and type any long random text for `JWT_SECRET`. Then:
```bash
npm run seed     # resets the DB: 17 universities + demo accounts
npm run dev      # starts the API on http://localhost:5000
```
You should see `MongoDB connected` and `ClearPath API running on port 5000`.
Check http://localhost:5000/api/health in your browser → `{"status":"ok"}`.

### Terminal 2 – React frontend
```bash
cd client
npm install
copy .env.example .env        # on Mac/Linux: cp .env.example .env
npm run dev
```
Open http://localhost:5173

### Demo accounts (password for all: `password123`)
| Role | Email |
| --- | --- |
| Platform admin (all universities) | platform@clearpath.lk |
| Ruhuna admin | demo.admin@ruh.ac.lk |
| Ruhuna officers | demo.lib@ · demo.hos@ · demo.fin@ · demo.lab@ · demo.spo@ · demo.saf@ruh.ac.lk |
| Ruhuna student with a library due | demo.kasun@ruh.ac.lk (EG/2021/4501) |
| Ruhuna student with no dues | demo.nimali@ruh.ac.lk |
| Colombo admin / student | demo.admin@cmb.ac.lk · demo.saman@cmb.ac.lk |
| Not yet registered (try Create account) | EG/2021/4519 + demo.amal@ruh.ac.lk · SC/2021/2001 + demo.ruwan@cmb.ac.lk |

`npm run seed` **wipes the database** and reloads the 17 universities and these accounts. Keep `SMTP_HOST` empty while using demo addresses: the registration code and reset link are then shown on screen instead of emailed.

While running `npm run dev`, the login page shows a small **Demo access** panel that fills these accounts in. It is hidden in a production build unless you set `VITE_SHOW_DEMO=true` in `client/.env`.

**Forgot password without email set up:** if `SMTP_HOST` is empty and `NODE_ENV` is not `production`, the forgot-password screen shows a direct "Open reset link" button so the flow can be demonstrated. With SMTP configured, the link is emailed instead.

---

## 3. Demo script for the viva (about 8 minutes)

1. **Home page** → explain the problem (paper form, 6 offices) and the solution.
2. **Log in as Kasun (demo.kasun@ruh.ac.lk)** → submit a clearance request (reason: Graduation).
   The tracker shows 6 departments; **Library already shows "Dues found"** because of the LKR 450 fine. Point out the dues table.
3. **Log out → log in as demo.lib@ruh.ac.lk** → Requests tab → click **Clear** on Kasun.
   The API refuses: *"Cannot clear: the student still has 1 unpaid due(s)"* (business rule enforced on the server).
4. **Log in as Kasun** → upload any image/PDF as the **payment receipt** for the library due.
   **Log in as demo.lib@** again → Dues tab → open the receipt → **Approve** → Requests tab → **Clear** Kasun (now it works).
5. Log in as each other officer (demo.hos@, demo.fin@, demo.lab@, demo.spo@, demo.saf@ruh.ac.lk) and click **Clear**
   (or, faster: log in as **admin → Requests tab → click each grey department chip** to override).
6. **Log in as Kasun again** → 100% cleared → **Download PDF** certificate → show the QR code.
7. Open the **Verify** page (or scan the QR with your phone when hosted) → certificate is valid.
8. **Admin → Overview**: workload chart per department, dues collected, average days to clear. **Audit** tab: every action is logged.
9. Optional: in Postman, call `GET /api/clearances/my` without a token → `401`; as a student call `GET /api/admin/users` → `403` (role-based access).

---

## 4. Host it online (free)

### 4a. Push to GitHub
```bash
git init
git add .
git commit -m "ClearPath MERN app"
git branch -M main
git remote add origin https://github.com/<you>/clearpath.git
git push -u origin main
```
(`.env` files are ignored by `.gitignore`, so your passwords are not uploaded.)

### 4b. Backend on Render (https://render.com)
1. New → **Web Service** → connect your GitHub repo.
2. **Root Directory:** `server` · **Build Command:** `npm install` · **Start Command:** `npm start` · Instance: Free.
3. **Environment variables:** `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN=7d`, `CLIENT_URL=https://<your-vercel-app>.vercel.app` (set it after step 4c, then redeploy).
4. Deploy → you get a URL like `https://clearpath-api.onrender.com`. Test `/api/health`.

> The free Render plan sleeps after 15 minutes idle; the first request then takes ~30–50 seconds. Open the API URL a minute before your demo. Uploaded receipts are stored on the server disk and are cleared when Render restarts — fine for a demo.

### 4c. Frontend on Vercel (https://vercel.com)
1. Add New → Project → import the same repo.
2. **Root Directory:** `client` · Framework preset: **Vite**.
3. Environment variable: `VITE_API_URL=https://clearpath-api.onrender.com` (your Render URL, no trailing slash).
4. Deploy. Copy the Vercel URL into Render's `CLIENT_URL` and redeploy Render (this fixes CORS and the QR code link).

---

## Pages in the app

| URL | Page | Who |
| --- | --- | --- |
| `/` | Landing page – what ClearPath does, how it works, features, roles, security, FAQ | Everyone |
| `/register`, `/login` | Two-step student registration and login (all roles, "Keep me signed in") | Everyone |
| `/forgot-password`, `/reset-password/:token` | Password reset by email (link valid 15 min, one use) | Everyone |
| `/verify`, `/verify/:no` | Public certificate verification | Everyone |
| `/help` | Help centre with step-by-step guides per role and troubleshooting | Everyone |
| `/student` | Tracker, dues, receipt upload, certificate download | Student |
| `/officer` | Department desk: review, clear/flag, dues and receipts | Officer |
| `/admin` | Overview charts, requests, users, departments, audit log | Admin |
| `/platform` | Universities, domains, logos and university admins | Platform admin |
| `/profile` | Account details, change password, dark mode | Logged-in users |
| anything else | Friendly 404 page | Everyone |

## Multi-university (one platform, a portal per university)
- All 17 UGC state universities are pre-loaded (`server/data/universities.js`) with their email domains.
- A user's email domain decides their university portal (e.g. `@ruh.ac.lk` → University of Ruhuna). Sub-domains match too.
- Every record (users, departments, requests, dues, certificates, student list) belongs to one university; every query is limited to the signed-in user's university.
- **Platform admin** (`platform@clearpath.lk`) manages universities, their domains, logos and each university's first admin at `/platform`.
- **Logos:** upload each university's official logo (PNG/JPG) on the platform screen; an initials badge shows until then. Logos are not bundled with the project.
- Registration numbers only need to be unique inside one university.

## Design system (colour rule)
The UI follows a **60-30-10** rule: 60% neutral surfaces, 30% ink (text, borders), 10% one brand colour (indigo `#4f46e5`) used only for primary buttons, links, focus and active states. Green, amber and red are reserved for status meaning (cleared/paid, dues, unpaid/error) and are never decorative. All colours are CSS variables in `client/src/styles.css`, so the brand colour can be changed in one place, and dark mode is built in.

## 5. Project structure
```
clearpath/
├── server/                    Express REST API
│   ├── server.js              app entry: middleware + routes
│   ├── config/db.js           MongoDB connection
│   ├── models/                Mongoose schemas (User, Department, ClearanceRequest, Due, Certificate, AuditLog)
│   ├── controllers/           business logic
│   ├── routes/                URL → controller mapping
│   ├── middleware/            JWT auth + role check, file upload, error handler
│   ├── utils/                 JWT, audit log, certificate numbers, email
│   └── seed.js                demo data
└── client/                    React (Vite) single-page app
    └── src/
        ├── api.js             axios instance (adds JWT automatically)
        ├── context/           login state (AuthContext)
        ├── components/        Navbar, ProtectedRoute, badges/alerts
        └── pages/             Home, Login, Register, Verify, student/, officer/, admin/
```

## 6. REST API summary
All routes start with `/api`. Protected routes need the header `Authorization: Bearer <token>`.

| Method | Endpoint | Who |
| --- | --- | --- |
| POST | /auth/register · /auth/login | Public |
| GET | /auth/me | Logged in |
| POST | /clearances | Student |
| GET | /clearances/my | Student |
| PATCH | /clearances/:id/cancel | Student |
| GET | /clearances/department?status= | Officer / Admin |
| PATCH | /clearances/:id/items/:deptId `{action: "clear"|"flag", remark}` | Officer / Admin |
| GET | /dues/my | Student |
| POST | /dues/:id/receipt (multipart `receipt`) | Student |
| GET | /dues/department · POST /dues `{regNo, amount, description}` | Officer |
| PATCH | /dues/:id/verify `{approve, waive, note}` · DELETE /dues/:id | Officer |
| GET | /certificates/:requestId/pdf | Student / Admin |
| GET | /verify/:certificateNo | Public |
| GET/POST/PATCH/DELETE | /departments | Admin (GET: all) |
| GET/POST/PATCH/DELETE | /admin/users | Admin |
| GET | /admin/requests · /admin/reports · /admin/audit | Admin |

## 7. Key technical points to mention
- **Security:** bcrypt password hashing, JWT auth, role-based middleware (`authorize('officer')`), Helmet headers, CORS restricted to the frontend, upload type/size limits (JPG/PNG/PDF, 3 MB).
- **Business rule in the API:** a department cannot be cleared while the student has unpaid dues there; adding a due automatically flags an active request.
- **Automatic certificate:** when the last department clears, the API issues a unique certificate number; the PDF (PDFKit) embeds a QR code (qrcode) that links to the public verify page.
- **Email notifications** (Nodemailer) on every action; without SMTP settings they are printed in the server console.
- **Audit log** of every approval, flag, due and account change.

## 8. Troubleshooting
| Problem | Fix |
| --- | --- |
| `MongoDB connection error` | Check `MONGO_URI`, the password, and that Atlas Network Access allows `0.0.0.0/0`. |
| Login says "Network Error" | The API is not running, or `VITE_API_URL` is wrong. Restart `npm run dev` after editing `.env`. |
| `Not allowed by CORS` | `CLIENT_URL` in `server/.env` must exactly match the frontend URL (no trailing slash). |
| Changed `.env` but nothing happened | Stop (Ctrl+C) and restart the server / Vite. |
| Port 5000 in use | Set `PORT=5001` in `server/.env` and `VITE_API_URL=http://localhost:5001`. |

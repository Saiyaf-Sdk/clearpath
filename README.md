# ClearPath – University Digital Clearance & No-Dues Management System

EC4307 – Web Application Development · MERN stack (MongoDB, Express, React, Node.js)

Students submit **one online clearance request**. Their own faculty's offices (faculty office, head of department, laboratories, faculty library) and the university's central offices (main library, finance, hostels, sports, student affairs) review it in parallel, record dues when something is owed, verify uploaded payment receipts, and clear the student. When the last office clears them, a **PDF certificate with a QR code** is issued automatically, and anyone can verify it on a public page.

One platform serves **all 17 Sri Lankan state universities and their 125 faculties**. Signing in is **university → faculty → log in**: each faculty has its own portal, offices, officers and faculty admin (for example, Ruhuna's Faculty of Engineering in Galle is run separately from the Matara campus), and every university only ever sees its own data.

---

## 1. Features

| Role | Pages |
| --- | --- |
| **Student** | Overview (progress, next steps, recent updates) · Clearance request (submit, live department tracker, history) · Dues & payments (upload receipts) · Certificate (preview, PDF download, QR, share link) |
| **Department officer** | Overview (workload, 14-day chart, money collected, average turnaround, oldest requests, recent activity) · Clearance requests (filter, search, sort, side panel, bulk clear, CSV export) · Receipts to verify · Dues register (add dues with live student check, settle, waive, export) · Activity history |
| **University admin** | Overview (KPIs and charts, filter by faculty) · **Faculties** (add / edit / deactivate, faculty admins, portal address) · All requests (faculty filter, full history drawer, admin override, CSV) · Reports (by faculty, reason, dues by office, print / CSV) · Official student list (by faculty, CSV import) · Users & staff · Offices (central and faculty) · Audit log |
| **Faculty admin** | The same pages limited to their own faculty: its students, officers, offices, requests, reports and audit log (central offices are read-only) |
| **Platform admin** | Overview of all universities · Universities (domains, logos, faculties, first admin) · Platform audit log |
| **Everyone** | Landing page, choose your university then your faculty (or Central administration), a separate portal per faculty, verified registration (student list + university email + 6-digit code), login with "keep me signed in", forgot / reset password, certificate verification, help centre, notifications bell, account settings with profile picture upload, dark mode |

**University logos:** put each university's official logo in `server/data/logos/<portal>.png` (e.g. `ruhuna.png`, list in that folder's README). They appear on the portals, sidebar, certificates and verify page after a server restart, seed or reset. The platform admin (Universities) or each university admin (Account settings) can also upload a logo in the app (PNG, JPG, WebP or SVG, up to 1 MB).

**Engineering:** JWT auth with role-based access · per-university data isolation · bcrypt passwords · Helmet security headers and CSP · CORS whitelist · brute-force rate limiting on sign-in routes · uploads stored in MongoDB (survive hosting restarts) · audit log of every action · in-app + email notifications · lazy-loaded pages · error boundaries (a crashing page never blanks the app) · every page has its own URL (refresh and back button work) · health check endpoint · graceful shutdown.

---

## 2. Screenshots

| | |
| --- | --- |
| ![Choose your university](docs/screenshots/02-choose-university.png) **Choose your university** – each university has its own portal | ![University portal](docs/screenshots/03-portal-login.png) **University portal** – log in or create an account |
| ![Student clearance](docs/screenshots/06-student-clearance.png) **Student** – live tracker for every department | ![Student dues](docs/screenshots/07-student-dues.png) **Student** – dues and receipt upload |
| ![Officer request drawer](docs/screenshots/10-officer-request-drawer.png) **Officer** – review a request, approve a receipt, add a due | ![Officer dues](docs/screenshots/11-officer-dues.png) **Officer** – dues register (add, edit, settle, sort, export) |
| ![Admin reports](docs/screenshots/13-admin-reports.png) **Admin** – reports and charts | ![Admin students](docs/screenshots/14-admin-students.png) **Admin** – official student list (search, sort, edit, import) |
| ![Platform universities](docs/screenshots/15-platform-universities.png) **Platform admin** – universities, portals and admins | ![Verify certificate](docs/screenshots/16-verify-certificate.png) **Public** – QR certificate verification |

More in [`docs/screenshots`](docs/screenshots), including a phone layout and dark mode.

---

## 3. Run it on your computer

You need **Node.js 18+** (https://nodejs.org) and a free **MongoDB Atlas** database.

### 3a. MongoDB Atlas (once, ~5 minutes)
1. Sign up at https://www.mongodb.com/cloud/atlas/register and create a free **M0** cluster (AWS, Mumbai is closest).
2. Create a database user (letters and numbers only in the password).
3. **Network Access → Add IP Address → Allow access from anywhere** (`0.0.0.0/0`).
4. **Connect → Drivers → Node.js** → copy the connection string and add `clearpath` after `.net/`:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/clearpath?retryWrites=true&w=majority`

### 3b. Backend (terminal 1)
```bash
cd server
npm install
copy .env.example .env        # Mac/Linux: cp .env.example .env
```
Edit `server/.env`: paste your connection string into `MONGO_URI` and type a long random `JWT_SECRET`. Then:
```bash
npm run seed     # resets the database: 17 universities + realistic demo data
npm run dev      # API on http://localhost:5000  → "MongoDB connected"
```

### 3c. Frontend (terminal 2)
```bash
cd client
npm install
npm run dev      # opens http://localhost:5173
```
`client/.env` should contain `VITE_API_URL=http://localhost:5000`.

### 3d. Demo accounts (password for all: `password123`)
**Signing in:** press **Log in** → choose the university → choose the **faculty** (e.g. `/portal/ruhuna/engineering`) or **Central administration** (`/portal/ruhuna/central`) → log in or create an account there. Students, faculty officers and faculty admins use their faculty; the university admin and central office officers use Central administration. A wrong door is refused with a link to the right one. The platform admin uses **Platform administrator sign-in** at the bottom of the university list (`/platform-login`).

**Who creates whom:** platform admin → each university's admin (Universities page) → faculties and faculty admins (Faculties page) → offices and officers (Offices, Users & staff) → the official student list. Students then create their own accounts.

| Where | Who | Email | What you'll see |
| --- | --- | --- | --- |
| Ruhuna · Engineering | Student | `demo.kasun@ruh.ac.lk` | Request in progress, 5 of 9 offices cleared, LKR 450 fine at the Engineering Faculty Library |
| Ruhuna · Engineering | Student | `demo.nimali@ruh.ac.lk` | Fully cleared, certificate ready |
| Ruhuna · Engineering | Student | `demo.tharindu@ruh.ac.lk` | No request yet – use him to show submitting one |
| Ruhuna · Engineering | Faculty admin | `demo.eng.admin@ruh.ac.lk` | Only Engineering: its students, officers, offices, reports |
| Ruhuna · Engineering | Faculty officers | `demo.eng.flib@`, `demo.eng.lab@`, `demo.eng.hod@`, `demo.eng.office@ruh.ac.lk` | Faculty library (Galle), labs, head of department, faculty office |
| Ruhuna · Science | Student / faculty admin | `demo.hiruni@ruh.ac.lk`, `demo.sci.admin@ruh.ac.lk` | A different faculty with its own offices |
| Ruhuna · Central administration | University admin | `demo.admin@ruh.ac.lk` | Whole university, all faculties, Faculties page |
| Ruhuna · Central administration | Central officers | `demo.lib@`, `demo.fin@`, `demo.hos@`, `demo.spo@`, `demo.saf@ruh.ac.lk` | Main library, finance, hostels, sports, student affairs – students of every faculty |
| Colombo · Science | Student | `demo.saman@cmb.ac.lk` (admin `demo.admin@cmb.ac.lk`) | University of Colombo (separate data) |
| Any university | Same pattern | `demo.admin@<domain>`, `demo.<faculty code>.admin@<domain>` … | All 17 universities have faculties, offices, staff and students |
| Platform | Platform admin | `platform@clearpath.lk` | All universities |
| Ruhuna · Engineering | Register a new student | Reg. no `EG/2021/4519` + `demo.amal@ruh.ac.lk` | Create account on the Engineering portal (code on screen when no email is set up) |

`npm run seed` wipes the database each time.

**Fresh start without demo data:** `npm run reset -- --yes` (in `server`) deletes everything and keeps only the 17 universities with their faculties and a platform admin (a strong password is printed; or add `--email you@x.com --password "YourPass123"`). Add `--empty` to leave the database completely empty. `npm run seed` brings the demo data back. While `npm run dev` runs, the login page has a **Demo access** panel that fills these in.

---

## 4. Deploy it online (free) – one service on Render

The Express server also serves the built React app, so the whole system is **one web service with one URL** (no CORS setup, the QR codes point to the right address automatically).

1. **Push the project to GitHub** (`.env` files are ignored, so your passwords stay private):
   ```bash
   git add .
   git commit -m "ClearPath"
   git branch -M main
   git remote add origin https://github.com/<you>/clearpath.git
   git push -u origin main
   ```
2. **Render** (https://render.com) → sign in with GitHub → **New → Blueprint** → choose the repository. Render reads `render.yaml`.
3. When asked, paste your Atlas connection string as **`MONGO_URI`**. `JWT_SECRET` is generated for you.
4. Click **Apply**. The first build takes a few minutes. You get a URL like `https://clearpath.onrender.com`.
5. **Load the demo data into the online database**: on your computer, with `MONGO_URI` in `server/.env` pointing to the same Atlas database, run `npm run seed` in `server` (or seed once and both local and online use it).
6. Open the URL → home page. Check `https://<your-app>.onrender.com/api/health` → `{"status":"ok","db":"connected"}`.

**Manual setup instead of the Blueprint:** New → Web Service → repository → Runtime **Node**, Build command `npm run build`, Start command `npm start`, Health check path `/api/health`, and environment variables `NODE_ENV=production`, `MONGO_URI`, `JWT_SECRET` (long random text), `JWT_EXPIRES_IN=7d`, and for the demo `VITE_SHOW_DEMO=true`, `DEMO_MODE=true`.

> The free Render plan sleeps after 15 minutes without visitors; the first visit then takes about a minute. Open the site a few minutes before your demonstration.

**Before a real (non-demo) launch:** set `VITE_SHOW_DEMO=false` and `DEMO_MODE=false`, set up email (Gmail relay, see below) so registration codes and reset links are emailed, run `npm run seed` only once (or create universities and admins from the platform screen), and change every demo password.

### Email (registration codes, password reset, notifications)
Without email settings, emails are printed in the server console and (locally / with `DEMO_MODE=true`) codes and reset links are shown on screen. To send real emails:

- **Gmail relay – works locally and on Render (recommended).** A tiny Google Apps Script sends from your own Gmail over HTTPS: free (~100 emails/day), no domain, no approval. Open `server/scripts/gmail-relay.gs` and follow the 5 steps at the top (paste into script.google.com → set a secret → Deploy as Web app, access *Anyone*). Then set `MAIL_SCRIPT_URL=<web app URL>` and `MAIL_SCRIPT_SECRET=<same secret>`.
- **Gmail SMTP – your computer only** (Render's free plan blocks SMTP ports). Turn on 2-Step Verification → https://myaccount.google.com/apppasswords → create an app password. Set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER=you@gmail.com`, `SMTP_PASS=<16-character app password>`, `MAIL_FROM="ClearPath <you@gmail.com>"`.
- **Brevo API** (`BREVO_API_KEY`) is also supported, but new Brevo accounts can't send until Brevo support approves them (they ask for a verified domain).

Test it with `npm run test-email -- you@example.com` in `server`. Seeded `demo.` accounts are never emailed (so no mail goes to real university servers). To try registration with real email, add your own university email to the **Official student list** as admin, then register with it.

### Alternative: frontend on Vercel, API on Render
Deploy `server` as a Render web service (root directory `server`, start `npm start`) with `CLIENT_URL=https://<app>.vercel.app`, and deploy `client` on Vercel (root directory `client`, preset Vite) with `VITE_API_URL=https://<api>.onrender.com`. `client/vercel.json` already handles page refreshes.

### Environment variables (server)
| Variable | Required | Meaning |
| --- | --- | --- |
| `MONGO_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes | Secret for login tokens (≥ 24 characters in production) |
| `JWT_EXPIRES_IN` | | Session length, default `7d` |
| `NODE_ENV` | | `production` on the server |
| `CLIENT_URL` | | Web app address(es), comma separated. Leave empty when the API serves the app |
| `APP_TIMEZONE` | | Time zone for charts, default `Asia/Colombo` |
| `DEMO_MODE` | | `true` shows codes/reset links on screen when SMTP is not set (demo only) |
| `MAIL_SCRIPT_URL`, `MAIL_SCRIPT_SECRET` | | Gmail relay for email (works on Render, see `server/scripts/gmail-relay.gs`) |
| `BREVO_API_KEY` | | Brevo API key (account must be approved by Brevo) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | | SMTP email instead of Brevo (e.g. Gmail app password, local only) |
| `MAIL_FROM` | | Sender, e.g. `ClearPath <you@gmail.com>` (a verified sender with Brevo) |
| `VITE_SHOW_DEMO` (build time) | | `true` shows the demo-accounts panel on the login page |

---

## 5. Project structure
```
clearpath/
├── package.json            root scripts: build (installs + builds the app), start, seed
├── render.yaml             one-click Render deployment
├── server/                 Express REST API (also serves client/dist in production)
│   ├── server.js           security headers, CORS, rate limits, routes, static app, shutdown
│   ├── config/db.js        MongoDB connection with retries
│   ├── models/             University, User, Department, ClearanceRequest, Due, Certificate,
│   │                       EnrolledStudent, AuditLog, Notification, StoredFile
│   ├── controllers/        auth, clearance, due, certificate, admin, stats, notification, file, university
│   ├── routes/             URL → controller mapping
│   ├── middleware/         JWT auth + roles, uploads, rate limiting, errors
│   ├── utils/              helpers (audit, notify, certificates), files, mailer, university policy
│   ├── data/universities.js the 17 state universities and their email domains
│   └── seed.js             realistic demo data
├── docs/screenshots/       screenshots used in this README
└── client/                 React 18 + Vite single-page app
    └── src/
        ├── App.jsx         routes (public pages + signed-in area), lazy loading
        ├── api.js          axios instance (JWT, session expiry)
        ├── context/        auth, theme, dialogs
        ├── hooks/          useFetch (loading/error states), useSort (sortable tables)
        ├── components/     app shell (sidebar, top bar, bell), UI kit, charts, error boundary
        └── pages/          public pages, student/, officer/, admin/, platform/, account/
```

## 6. Database design (ERD)

Every record belongs to one university (`university` reference), so each university only sees its own data. Students, faculty staff, requests and dues also carry their **faculty**, so a faculty admin only sees their own faculty; offices without a faculty are the university's central offices. A clearance request embeds one item per department; dues live in their own collection because they have their own life cycle and receipts.

```mermaid
erDiagram
    UNIVERSITY ||--o{ FACULTY : has
    UNIVERSITY ||--o{ DEPARTMENT : "central offices"
    FACULTY |o--o{ DEPARTMENT : "faculty offices"
    FACULTY ||--o{ USER : "students, faculty staff"
    FACULTY ||--o{ ENROLLED_STUDENT : lists
    FACULTY ||--o{ CLEARANCE_REQUEST : "student's faculty"
    UNIVERSITY ||--o{ USER : has
    UNIVERSITY ||--o{ ENROLLED_STUDENT : "official list"
    ENROLLED_STUDENT |o--o| USER : "activates"
    DEPARTMENT ||--o{ USER : "officers"
    USER ||--o{ CLEARANCE_REQUEST : submits
    USER ||--o{ DUE : owes
    DEPARTMENT ||--o{ DUE : records
    CLEARANCE_REQUEST ||--|{ CLEARANCE_ITEM : "items[] (one per department)"
    DEPARTMENT ||--o{ CLEARANCE_ITEM : reviews
    CLEARANCE_REQUEST ||--o| CERTIFICATE : "issued when all cleared"
    USER ||--o{ NOTIFICATION : receives
    USER ||--o{ AUDIT_LOG : "actor"
    USER ||--o{ STORED_FILE : uploads

    UNIVERSITY {
        ObjectId _id PK
        string name UK
        string code UK
        string slug UK
        string[] domains
        string logoUrl
        bool isActive
    }
    FACULTY {
        ObjectId _id PK
        ObjectId university FK
        string name
        string code
        string slug "portal address"
        string location
        bool isActive
    }
    DEPARTMENT {
        ObjectId _id PK
        ObjectId university FK
        ObjectId faculty FK "empty = central office"
        string name
        string code
        number order
        bool isActive
    }
    USER {
        ObjectId _id PK
        string email UK
        string password "bcrypt hash"
        string role "student|officer|facultyadmin|admin|superadmin"
        ObjectId facultyId FK
        ObjectId university FK
        ObjectId department FK
        string regNo
        string faculty
    }
    ENROLLED_STUDENT {
        ObjectId _id PK
        ObjectId university FK
        string regNo
        string email
        string status "pending|activated"
        ObjectId user FK
    }
    DUE {
        ObjectId _id PK
        ObjectId student FK
        ObjectId department FK
        number amount
        string description
        string status "unpaid|receipt-submitted|paid|waived"
        string receiptUrl
    }
    CLEARANCE_REQUEST {
        ObjectId _id PK
        ObjectId student FK
        string reason
        string note
        string status "pending|in-progress|completed|cancelled"
    }
    CLEARANCE_ITEM {
        ObjectId department FK
        string status "pending|cleared|dues"
        string remark
        ObjectId actionedBy FK
    }
    CERTIFICATE {
        ObjectId _id PK
        ObjectId request FK
        string certificateNo UK
        date issuedAt
    }
    NOTIFICATION {
        ObjectId _id PK
        ObjectId user FK
        string title
        bool read
    }
    AUDIT_LOG {
        ObjectId _id PK
        ObjectId actor FK
        string action
        string details
    }
    STORED_FILE {
        ObjectId _id PK
        string key UK
        string contentType
        binary data
    }
```

Unique rules: faculty `(university, slug)` and `(university, code)`; office `(university, faculty, code)` and `(university, faculty, name)`; student list `(university, regNo)`; user `email` and `(university, regNo)`. Indexes back the busiest queries (officer queue on `items.department + items.status`, dues by student/department, notifications by user).

## 7. REST API (all under `/api`)
| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/register/start · /register/verify · /register/complete · /login · /forgot-password`, `GET/POST /auth/reset-password/:token`, `GET/PATCH /auth/me`, `PATCH /auth/password` |
| Clearance | `POST /clearances`, `GET /clearances/my`, `PATCH /clearances/:id` (edit), `PATCH /clearances/:id/cancel`, `GET /clearances/department`, `PATCH /clearances/:id/items/:deptId` |
| Dues | `GET /dues/my`, `POST /dues/:id/receipt`, `GET /dues/department`, `GET /dues/lookup`, `POST /dues`, `PATCH /dues/:id` (edit), `PATCH /dues/:id/verify`, `DELETE /dues/:id` |
| Certificates | `GET /certificates/:requestId/pdf`, `GET /verify/:no` (public), `GET /verify/:no/qr.png` (public) |
| Dashboards | `GET /stats/badges`, `GET /stats/officer`, `GET /stats/officer/activity` |
| Notifications | `GET /notifications`, `PATCH /notifications/read-all`, `PATCH /notifications/:id/read`, `DELETE /notifications` |
| Faculties | `GET/POST /admin/faculties`, `PATCH/DELETE /admin/faculties/:id` (university admin; faculty admins read their own) |
| Admin | `GET/POST/PATCH/DELETE /admin/users`, `GET /admin/users/:id/summary`, `GET /admin/requests`, `GET /admin/requests/:id`, `GET /admin/reports`, `GET /admin/audit`, roster `GET/POST /admin/roster`, `POST /admin/roster/import`, `PATCH/DELETE /admin/roster/:id`, departments `GET/POST/PATCH/DELETE /departments` |
| Platform | `GET /platform/overview`, `GET /platform/audit`, `GET/POST/PATCH /platform/universities`, logos, admins |
| Public | `GET /universities`, `GET /universities/:portal` (with its faculties), `GET /universities/:portal/:faculty` (or `central`), `GET /universities/lookup?email=`, `GET /files/:key`, `GET /health` |

## 8. Design system
60-30-10 colour rule: 60% neutral surfaces, 30% ink, 10% one brand colour (indigo `#4f46e5`) for primary actions, links, focus and active states. Green, amber and red only ever mean cleared/paid, dues and unpaid/error. System fonts (San Francisco / Segoe UI / Roboto). Light and dark themes. All tokens are CSS variables in `client/src/styles.css`; the app shell lives in `client/src/app.css`.

## 9. Troubleshooting
| Problem | Fix |
| --- | --- |
| `MongoDB connection error` / `bad auth` | Check `MONGO_URI` and the password, and that Atlas Network Access allows `0.0.0.0/0`. |
| `querySrv ECONNREFUSED` | Your network's DNS blocks Atlas. Set DNS to `8.8.8.8` or use a mobile hotspot. |
| `Cannot find module …` after pulling changes | Delete `node_modules` and `package-lock.json` in that folder and run `npm install` again. |
| Login says "Cannot reach the server" | The API isn't running, or `VITE_API_URL` is wrong. Restart both after editing a `.env`. |
| Sent back to the login page after `npm run seed` | Normal – seeding creates new accounts, so old sessions end. Log in again. |
| Port 5000 in use | Set `PORT=5001` in `server/.env` and `VITE_API_URL=http://localhost:5001`. |
| Render build fails | Check the build log; the build command must be `npm run build` at the repository root. |

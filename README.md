# ClearPath – University Digital Clearance & No-Dues Management System

EE4207 – Web Application Development · MERN stack (MongoDB, Express, React, Node.js)

Students submit **one online clearance request**. Every department (Library, Hostel, Finance, Labs, Sports, Student Affairs) reviews it in parallel, records dues when something is owed, verifies uploaded payment receipts, and clears the student. When the last department clears them, a **PDF certificate with a QR code** is issued automatically, and anyone can verify it on a public page.

One platform serves **all 17 Sri Lankan state universities**: a user's university email decides which university portal they enter, and every university only ever sees its own data.

---

## 1. Features

| Role | Pages |
| --- | --- |
| **Student** | Overview (progress, next steps, recent updates) · Clearance request (submit, live department tracker, history) · Dues & payments (upload receipts) · Certificate (preview, PDF download, QR, share link) |
| **Department officer** | Overview (workload, 14-day chart, money collected, average turnaround, oldest requests, recent activity) · Clearance requests (filter, search, sort, side panel, bulk clear, CSV export) · Receipts to verify · Dues register (add dues with live student check, settle, waive, export) · Activity history |
| **University admin** | Overview (KPIs and charts) · All requests (filters, full history drawer, admin override, CSV) · Reports (faculty, reason, dues by department, print / CSV) · Official student list (CSV import) · Users & staff · Departments · Audit log |
| **Platform admin** | Overview of all universities · Universities (domains, logos, first admin) · Platform audit log |
| **Everyone** | Landing page, verified registration (student list + university email + 6-digit code), login with "keep me signed in", forgot / reset password, certificate verification, help centre, notifications bell, account settings, dark mode |

**Engineering:** JWT auth with role-based access · per-university data isolation · bcrypt passwords · Helmet security headers and CSP · CORS whitelist · brute-force rate limiting on sign-in routes · uploads stored in MongoDB (survive hosting restarts) · audit log of every action · in-app + email notifications · lazy-loaded pages · error boundaries (a crashing page never blanks the app) · every page has its own URL (refresh and back button work) · health check endpoint · graceful shutdown.

---

## 2. Run it on your computer

You need **Node.js 18+** (https://nodejs.org) and a free **MongoDB Atlas** database.

### 2a. MongoDB Atlas (once, ~5 minutes)
1. Sign up at https://www.mongodb.com/cloud/atlas/register and create a free **M0** cluster (AWS, Mumbai is closest).
2. Create a database user (letters and numbers only in the password).
3. **Network Access → Add IP Address → Allow access from anywhere** (`0.0.0.0/0`).
4. **Connect → Drivers → Node.js** → copy the connection string and add `clearpath` after `.net/`:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/clearpath?retryWrites=true&w=majority`

### 2b. Backend (terminal 1)
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

### 2c. Frontend (terminal 2)
```bash
cd client
npm install
npm run dev      # opens http://localhost:5173
```
`client/.env` should contain `VITE_API_URL=http://localhost:5000`.

### 2d. Demo accounts (password for all: `password123`)
| Who | Email | What you'll see |
| --- | --- | --- |
| Student | `demo.kasun@ruh.ac.lk` | Request in progress, LKR 450 library fine |
| Student | `demo.nimali@ruh.ac.lk` | Fully cleared, certificate ready |
| Student | `demo.tharindu@ruh.ac.lk` | No request yet – use him to show submitting one |
| Library officer | `demo.lib@ruh.ac.lk` | Busy department desk (also `demo.hos@`, `demo.fin@`, `demo.lab@`, `demo.spo@`, `demo.saf@ruh.ac.lk`) |
| University admin | `demo.admin@ruh.ac.lk` | ~48 students, 40 requests, charts, audit log |
| Another university | `demo.saman@cmb.ac.lk`, `demo.admin@cmb.ac.lk` | University of Colombo portal (separate data) |
| Platform admin | `platform@clearpath.lk` | All universities |
| Register a new student | Reg. no `EG/2021/4519` + `demo.amal@ruh.ac.lk` | The 6-digit code is shown on screen (no email set up) |

`npm run seed` wipes the database each time. While `npm run dev` runs, the login page has a **Demo access** panel that fills these in.

---

## 3. Deploy it online (free) – one service on Render

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

**Before a real (non-demo) launch:** set `VITE_SHOW_DEMO=false` and `DEMO_MODE=false`, configure SMTP (e.g. a Gmail app password or Brevo) so registration codes and reset links are emailed, run `npm run seed` only once (or create universities and admins from the platform screen), and change every demo password.

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
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | | Email sending; empty = print emails to the server log |
| `VITE_SHOW_DEMO` (build time) | | `true` shows the demo-accounts panel on the login page |

---

## 4. Demonstration script (about 10 minutes)

1. **Home page** – the problem (paper form, six offices) and the solution. Show the university email → portal idea.
2. **Kasun (student)** – Overview shows 3 of 6 cleared and exactly what to do next. Open **Dues & payments** and upload any image/PDF as the receipt for the LKR 450 library fine.
3. **Library officer** (`demo.lib@`) – the Overview chart, KPIs and badges. Open **Receipts to verify** → approve. Kasun automatically returns to the **Pending** list ("dues settled – waiting for final check") → **Clear**.
4. Try to clear a student who still owes money → the server refuses (business rule enforced in the API).
5. Clear Kasun in the remaining departments (log in as `demo.lab@` and `demo.saf@`, or as **admin → All requests → click the grey chips** to override).
6. **Kasun** – the **Certificate** page: preview, download the PDF, copy the verification link. Open **/verify** (or scan the QR on your phone when deployed) → valid.
7. **Tharindu** – submit a brand-new request and watch it appear in every officer's list and bell.
8. **Admin** – Overview and **Reports** (faculty, reasons, dues by department, CSV export), **Audit log**, **Official student list** import, then **register Amal** from the Create account page with the on-screen code.
9. **Colombo admin** – a different university sees completely different data. **Platform admin** – all universities, logos and domains.
10. Security points: role-based routes (a student opening `/admin` is sent to their own dashboard), JWT expiry, rate limiting, per-university isolation.

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
└── client/                 React 18 + Vite single-page app
    └── src/
        ├── App.jsx         routes (public pages + signed-in area), lazy loading
        ├── api.js          axios instance (JWT, session expiry)
        ├── context/        auth, theme, dialogs
        ├── hooks/useFetch  data loading with loading/error states
        ├── components/     app shell (sidebar, top bar, bell), UI kit, charts, error boundary
        └── pages/          public pages, student/, officer/, admin/, platform/, account/
```

## 6. REST API (all under `/api`)
| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/register/start · /register/verify · /register/complete · /login · /forgot-password`, `GET/POST /auth/reset-password/:token`, `GET/PATCH /auth/me`, `PATCH /auth/password` |
| Clearance | `POST /clearances`, `GET /clearances/my`, `PATCH /clearances/:id/cancel`, `GET /clearances/department`, `PATCH /clearances/:id/items/:deptId` |
| Dues | `GET /dues/my`, `POST /dues/:id/receipt`, `GET /dues/department`, `GET /dues/lookup`, `POST /dues`, `PATCH /dues/:id/verify`, `DELETE /dues/:id` |
| Certificates | `GET /certificates/:requestId/pdf`, `GET /verify/:no` (public), `GET /verify/:no/qr.png` (public) |
| Dashboards | `GET /stats/badges`, `GET /stats/officer`, `GET /stats/officer/activity` |
| Notifications | `GET /notifications`, `PATCH /notifications/read-all`, `PATCH /notifications/:id/read`, `DELETE /notifications` |
| Admin | `GET/POST/PATCH/DELETE /admin/users`, `GET /admin/users/:id/summary`, `GET /admin/requests`, `GET /admin/requests/:id`, `GET /admin/reports`, `GET /admin/audit`, roster `GET/POST /admin/roster`, `POST /admin/roster/import`, `DELETE /admin/roster/:id`, departments `GET/POST/PATCH/DELETE /departments` |
| Platform | `GET /platform/overview`, `GET /platform/audit`, `GET/POST/PATCH /platform/universities`, logos, admins |
| Public | `GET /universities`, `GET /universities/lookup?email=`, `GET /files/:key`, `GET /health` |

## 7. Design system
60-30-10 colour rule: 60% neutral surfaces, 30% ink, 10% one brand colour (indigo `#4f46e5`) for primary actions, links, focus and active states. Green, amber and red only ever mean cleared/paid, dues and unpaid/error. System fonts (San Francisco / Segoe UI / Roboto). Light and dark themes. All tokens are CSS variables in `client/src/styles.css`; the app shell lives in `client/src/app.css`.

## 8. Troubleshooting
| Problem | Fix |
| --- | --- |
| `MongoDB connection error` / `bad auth` | Check `MONGO_URI` and the password, and that Atlas Network Access allows `0.0.0.0/0`. |
| `querySrv ECONNREFUSED` | Your network's DNS blocks Atlas. Set DNS to `8.8.8.8` or use a mobile hotspot. |
| `Cannot find module …` after pulling changes | Delete `node_modules` and `package-lock.json` in that folder and run `npm install` again. |
| Login says "Cannot reach the server" | The API isn't running, or `VITE_API_URL` is wrong. Restart both after editing a `.env`. |
| Sent back to the login page after `npm run seed` | Normal – seeding creates new accounts, so old sessions end. Log in again. |
| Port 5000 in use | Set `PORT=5001` in `server/.env` and `VITE_API_URL=http://localhost:5001`. |
| Render build fails | Check the build log; the build command must be `npm run build` at the repository root. |

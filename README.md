# Vertexon.AI — LMS-AI Learning Platform

A complete, locally runnable Learning Management System with three role-based workspaces, course delivery, assessments, community, certificates, and a course-grounded AI tutor.

> **Submission note (Hinglish):** Yeh project bina Docker, bina external database aur bina paid AI API ke locally chalega. `npm install` ke baad `npm run dev` — demo accounts niche diye gaye hain.

**Project folder:** `C:\Users\ANSH\OneDrive\Documents\Vertexon-AI-LMS`

---

## 1. What is included

### Student workspace
- JWT + refresh-token authentication with protected routes
- Live dashboard with streak, study target, active courses, quiz average, recommendations, and activity
- Course catalog with search, category, difficulty, rating, price filters, sorting, enrollment, resume, and progress tracking
- Lesson player with playback controls, watch progress, completion, bookmarks, timestamped notes, lecture summary, transcript, downloadable resources, course announcements, and lecture-grounded Q&A
- Mixed-format practice quizzes (single choice, multi-select, short answer) with attempts, timers, flags, hints, auto-grading, submitted results, explanations, and answer review
- Per-topic mastery tracking from quiz performance, surfaced in the AI Tutor
- Assignments with file upload, resubmission, grades, and instructor feedback
- Community discussions, replies, reporting, and course-linked threads
- Achievements, badges, streaks, XP, leaderboard, and real certificate PDF download
- Automatic certificate issuance and milestone badge awards when a course reaches 100%
- Notifications and global search

### Instructor workspace
- Teaching dashboard with learners, published courses, completion, grading queue, and revenue
- Course authoring: create course with cover image/URL, add modules and lectures, upload slide decks, source files, and MP4/WebM video, attach external video URLs, and paste transcripts for AI indexing
- Quiz draft generation and publishing
- Assignment creation, submission review, grading, and feedback
- Course analytics with lecture engagement and learner roster
- Announcements to enrolled learners with in-app and email delivery

### Admin workspace
- Platform overview: users, courses, enrollments, completion, moderation, revenue
- Course approval and rejection queue
- User directory with role management, suspension, deletion/anonymization, and audit-safe guardrails
- Moderation queue for reported discussion posts
- Local email delivery outbox for instructor announcements, grades, certificates, and milestone notifications
- Audit log of privileged actions

### Platform and UX
- Dark-first premium UI with responsive desktop/tablet/mobile layouts and reduced-motion support
- English/Hindi i18n scaffolding for navigation and application chrome, persisted in local storage
- Optional app-only `docker-compose.yml`; Docker is not required for the demo

### AI tutor
- Real API-backed chat: `POST /api/v1/ai/chat`
- Retrieval from indexed lecture transcripts stored in SQLite (`document_chunks`)
- Every grounded answer returns source citations with lecture title and timestamp
- Beginner / intermediate / advanced answer modes
- Session history, lecture summaries, flashcards, and study plans
- Dynamic recommendations from topic mastery, quiz average, category affinity, and difficulty fit
- Deterministic local answer engine — **no paid LLM key required**

---

## 2. Demo accounts

| Role | Email | Password |
|---|---|---|
| Student | `ananya@vertexon.ai` | `Student123!` |
| Instructor | `rohit@vertexon.ai` | `Instructor123!` |
| Admin | `meera@vertexon.ai` | `Admin123!` |

The login screen also has one-click demo buttons for all three roles.

---

## 3. Run locally

### Requirements
- **Node.js 24+** (recommended; uses built-in `node:sqlite`)
- npm 10+
- No Docker, Postgres, Redis, Python, or cloud services required

### First run

```bash
cd "C:\Users\ANSH\OneDrive\Documents\Vertexon-AI-LMS"
npm install
npm run dev
```

Open **http://127.0.0.1:5173**.

`npm run dev` starts:
- Vite frontend on port `5173`
- API server on `127.0.0.1:5174` (Vite proxies `/api` and `/uploads`)

The SQLite database is created and seeded automatically on first API start.

### Production-style local run

```bash
npm run build
npm start
```

`npm start` serves the built frontend from `dist/` and the API from the same Node process at **http://127.0.0.1:5174**.

### Reset demo data

Stop the API first (Windows may lock the SQLite file), then run:

```bash
npm run db:reset
npm run dev
```

This recreates the seeded database and clears uploaded files.

---

## 4. Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Frontend + API together |
| `npm run dev:web` | Vite only |
| `npm run dev:server` | API only with `node --watch` |
| `npm start` | Production API + built frontend |
| `npm run build` | Typecheck and create `dist/` |
| `npm run typecheck` | TypeScript only |
| `npm run db:reset` | Reset SQLite database and uploads |
| `npm run test:api` | Isolated 28-check API smoke suite on port 5199 |

Latest verified result: **28/28 API smoke checks passed**, TypeScript passes, and the production build succeeds (with the existing Vite chunk-size warning).

---

## 5. Tech stack

**Frontend:** React 18, TypeScript, Vite 6, React Router 6, Tailwind CSS, lucide-react  
**Backend:** Express 4, built-in `node:sqlite`, JWT, bcryptjs, Multer, pdf-lib  
**Storage:** SQLite database at `server/data/vertexon.db` + local `uploads/`  
**AI retrieval:** local token-overlap retrieval over indexed lecture transcript chunks  
**Certificates:** generated on demand as real PDFs with `pdf-lib`

No external SaaS is required for the demo. The app is desktop-first and responsive down to tablet/mobile widths.

---

## 6. Architecture

```text
Browser (React + Vite)
   │  /api/v1/* and /uploads/*
   ▼
Express API (server/index.mjs)
   ├── auth.mjs / JWT + refresh rotation + bcrypt
   ├── middleware: RBAC, rate limits, security headers, upload validation
   ├── routes/auth.mjs
   ├── routes/courses.mjs
   ├── routes/learning.mjs
   ├── routes/quizzes.mjs
   ├── routes/ai.mjs
   ├── routes/instructor.mjs
   ├── routes/admin.mjs
   └── routes/certificates.mjs
   ▼
SQLite (node:sqlite)
   ├── users, refresh_tokens
   ├── courses, modules, lectures, enrollments, lecture_progress
   ├── notes, bookmarks, assignments, submissions
   ├── quizzes, questions, attempts, answers, topic_mastery
   ├── certificates, badges, streaks
   ├── ai sessions/messages, document_chunks, flashcards, study_plans
   ├── discussions, announcements, notifications, email_outbox
   └── approvals, payments, audit_logs
```

### AI retrieval flow

1. Instructor creates a lecture and pastes a transcript.
2. The API stores transcript chunks in `document_chunks` with lecture and timestamp metadata.
3. A student question is tokenized and scored against chunks from the selected course.
4. The top matching chunks produce a grounded answer plus source citations.
5. Citations are returned to the UI as `lecture_title`, `timestamp_seconds`, and `snippet`.

This is a real retrieval pipeline, intentionally local and deterministic so the submission always works offline.

### Email and notifications

- Important events (announcements, grades, certificates, badge unlocks) create an in-app notification.
- The same events are delivered through `server/accomplishments.mjs` to a local email adapter.
- Messages are stored in the `email_outbox` table, mirrored to `server/data/mail-outbox.log`, and exposed to admins at `GET /api/v1/admin/email-outbox`.
- The `queueEmail` function is the seam for a real SMTP/SES integration; no paid provider is needed for the demo.

### Automatic achievements

- Completing 100% of a course automatically issues a real PDF certificate and unlocks the First Course badge.
- A perfect quiz unlocks Perfect Score; five 90%+ attempts unlock Quiz Master; a seven-day streak unlocks the streak badge.
- Certificate issuance and badge awards are idempotent and write audit/notification records.

### Auth and RBAC

- Short-lived access tokens + rotating refresh tokens
- Passwords hashed with bcrypt
- Role checks on all sensitive routes: `student`, `instructor`, `admin`
- Admin route group is protected server-side, not just hidden in the UI
- Suspension revokes active refresh tokens
- Rate limits on auth, AI, and general API routes
- Security headers, request size limits, upload MIME/extension validation

---

## 7. API overview

Base path: `/api/v1`

| Area | Representative endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| Courses | `GET /courses`, `GET /courses/:id`, `POST /courses`, `POST /courses/:id/modules`, `POST /modules/:id/lectures` |
| Learning | `POST /courses/:id/enroll`, `GET /enrollments/me`, `GET /dashboard/me`, `POST /lectures/:id/progress`, `GET /mastery/me` |
| Uploads | `POST /uploads/material` (instructor/admin) |
| Notes/bookmarks | `GET/POST /lectures/:id/notes`, `PUT/DELETE /notes/:id`, `POST /lectures/:id/bookmarks` |
| Assignments | `GET /assignments/me`, `POST /assignments`, `POST /assignments/:id/submit`, `PUT /submissions/:id/grade` |
| Quizzes | `GET /quizzes/:id`, `POST /quizzes/:id/attempt`, `POST /attempts/:id/submit` |
| AI | `POST /ai/chat`, `GET /ai/sessions/me`, `POST /ai/lectures/:id/summarize`, `POST /ai/study-plan` |
| Community | `GET /discussions`, `POST /discussions`, `POST /discussions/:id/posts`, `POST /discussion-posts/:id/flag` |
| Gamification | `GET /gamification/me`, `GET /leaderboard/:courseId`, `GET /recommendations/me` |
| Certificates | `GET /certificates/me`, `POST /certificates/courses/:courseId/issue`, `GET /certificates/:id/download` |
| Instructor | `GET /instructor/overview`, `GET /instructor/analytics`, `GET /instructor/submissions`, `POST /instructor/quizzes/:id/publish`, `POST /courses/:id/announcements` |
| Admin | `GET /admin/overview`, `GET/PUT /admin/users/:id/role`, `PUT /admin/users/:id/suspend`, `DELETE /admin/users/:id`, `GET /admin/email-outbox`, `GET /admin/moderation/flagged` |
| Health | `GET /health` |

Protected endpoints expect `Authorization: Bearer <access_token>`.

---

## 8. Project structure

```text
Vertexon-AI-LMS/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .env.example
├── .node-version
├── .github/workflows/ci.yml
├── docs/
│   ├── ARCHITECTURE.md
│   ├── COMPLIANCE.md
│   ├── PRD-COVERAGE.md
│   └── RENDER.md
├── src/
│   ├── App.tsx                 # route map + role guards
│   ├── context/AuthContext.tsx # user session state
│   ├── lib/api.ts              # typed client, refresh, upload/download
│   ├── lib/i18n.tsx            # English/Hindi scaffolding
│   ├── components/             # shell, sidebar, topbar, toasts, guards, video
│   └── pages/                  # Student, Instructor, Admin, Auth screens
├── server/
│   ├── index.mjs               # Express entry + static dist serving
│   ├── schema.mjs              # 34-table SQLite schema
│   ├── seed.mjs                # canonical demo data
│   ├── ai.mjs                  # local retrieval + answer engine
│   ├── auth.mjs                # JWT + RBAC + upload middleware
│   ├── upload.mjs
│   └── routes/
├── tests/api-smoke.mjs         # 28-check isolated API suite
└── uploads/                    # local submitted files
```

---

## 9. Optional Docker

Docker is **not needed** for the submission demo. A production-style image is included for convenience:

```bash
docker build -t vertexon-lms .
docker run --rm -p 5174:5174 -v vertexon-data:/app/server/data -v vertexon-uploads:/app/uploads vertexon-lms
```

Or use the optional app-only compose file:

```bash
docker compose up --build
```

Open **http://127.0.0.1:5174**.

The compose file intentionally runs only the SQLite-backed app. It does not pretend to provide the PRD's Postgres, Redis, or MinIO topology; that migration path is documented in `docs/PRD-COVERAGE.md`.

### Render

**No AI API key is required.** The AI tutor uses local retrieval, not Gemini/OpenAI/Anthropic. For exact Render build, start, environment-variable, and persistent-disk settings, see `docs/RENDER.md`.

---

## 10. Tests and QA checklist

```bash
npm run typecheck
npm run test:api
npm run build
```

Manual demo path:
1. Login as **Student** → open Dashboard → resume DSA lesson → mark complete → add note → open Quiz → submit → view result.
2. Open AI Tutor → ask “How does Dijkstra find the shortest path?” → confirm cited lecture sources.
3. Open Assignments → resubmit the graded Dijkstra file → confirm success toast.
4. Open Achievements → download the certificate PDF.
5. Login as **Instructor** → open Courses → add a module/lecture with transcript and attached material (or an MP4/WebM video) → post an announcement → grade a submission.
6. Login as **Admin** → approve the pending GenAI course → change a user role → delete a test learner → resolve a moderation report.
7. Use the language button in the top bar to switch English/Hindi; confirm the sidebar and page chrome update and the choice persists after reload.

---

## 11. Known scope and production roadmap

This is a complete local demo/submission build, not a production cloud deployment:

- SQLite and local file uploads are used instead of Postgres/pgvector and object storage.
- AI answers are retrieval-grounded and deterministic instead of calling an external LLM.
- Demo lectures use the custom player; uploaded MP4/WebM files use a native HTML5 player with resume and speed controls. A real deployment would connect HLS/S3.
- Email delivery is captured in a local outbox/log and `queueEmail` is the SMTP/SES adapter seam; no paid provider is configured.
- Payments are represented by seeded records; OAuth SSO and live billing are not implemented.
- For production: move to Postgres + pgvector, object storage, managed secrets, HTTPS, observability, and a queue for document ingestion.

See `docs/PRD-COVERAGE.md` for the line-by-line PRD matrix and `docs/ARCHITECTURE.md` / `docs/COMPLIANCE.md` for more detail.

---

## 12. Troubleshooting

| Problem | Fix |
|---|---|
| Port 5173 busy | Vite automatically picks the next port; open the URL printed in the terminal |
| API not reachable | Confirm `http://127.0.0.1:5174/api/v1/health` returns `{"status":"ok"}` |
| Database locked on reset | Stop the API/dev server first, then `npm run db:reset` |
| Login lost after DB reset | Log out and log in again with a seeded demo account |
| Blank page after changing roles | Clear site storage or use the demo login button for the desired role |
| Node version error | Use Node 24+ (`node --version`) |

---

## 13. Submission checklist

- [x] Student, Instructor, and Admin role workspaces
- [x] JWT auth, refresh rotation, and server-side RBAC
- [x] Working student LMS flows and progress persistence
- [x] AI tutor with real retrieval citations
- [x] Quizzes, assignments, grading, feedback, and resubmission
- [x] Single-choice, multi-select, and short-answer auto-grading with topic mastery
- [x] Community, notifications, badges, streaks, and automatic certificates
- [x] Instructor authoring, material uploads, announcements, and analytics
- [x] Admin approvals, user management/deletion, moderation, and audit logs
- [x] English/Hindi i18n scaffolding and dark-first UI
- [x] 28-check API smoke suite, typecheck, and production build
- [x] Local setup docs, Dockerfile, compose file, CI workflow, architecture, compliance, and PRD coverage notes

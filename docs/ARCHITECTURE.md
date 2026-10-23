# Vertexon.AI — Architecture Notes

## 1. System shape

```text
React SPA (Vite) ──HTTP──> Express API ──SQLite
       │                        │
       └── local uploads <──────┘
```

The repository is a single Node project with two runtime entry points:

- `src/main.tsx` — React SPA
- `server/index.mjs` — Express API, upload server, and production static host

In development Vite proxies `/api` and `/uploads` to `127.0.0.1:5174`. In production `npm start` serves the built SPA from `dist/` and the API from the same process.

## 2. Frontend

- **Routing:** React Router with `RequireAuth` and role-specific guards.
- **Session:** `AuthContext` calls `/auth/me`, stores the access and refresh tokens in local storage, and exposes user, streak, notifications, and logout.
- **API client:** `src/lib/api.ts` centralizes JSON requests, uploads, authenticated downloads, error normalization, and one-refresh-token retry.
- **UI shell:** `AppShell` + `Sidebar` + `Topbar` provide role-aware navigation, global search, notifications, profile menu, mobile drawer, and English/Hindi language switching.
- **i18n:** `src/lib/i18n.tsx` provides a small dictionary-based scaffold for navigation and application chrome; the selected language persists in local storage.
- **Design:** Tailwind CSS with a dark purple/teal design system, desktop-first layout, responsive breakpoints, reduced-motion-friendly transitions.

## 3. Backend

### Middleware order

1. Security headers and CORS
2. JSON / URL-encoded body parsing
3. Request rate limiting
4. Auth and RBAC middleware on protected route modules
5. Route handlers
6. Centralized error handling (including Multer errors)

### Route modules

| Module | Responsibility |
|---|---|
| `auth.mjs` | register, login, refresh rotation, logout, current user, demo accounts |
| `courses.mjs` | catalog, course detail, course/module/lecture authoring, approvals, announcements |
| `learning.mjs` | enrollment, dashboard, progress, notes, bookmarks, assignments, grading, discussions, notifications, gamification, dynamic recommendations |
| `quizzes.mjs` | quiz detail, attempt creation, single-choice/multi-select/short-answer grading, mastery updates |
| `ai.mjs` | course-grounded chat, session history, summaries, quiz generation, flashcards, study plans |
| `instructor.mjs` | teaching overview, course list, analytics, roster, grading queue, announcements, quiz publishing |
| `admin.mjs` | overview, user roles/suspension/deletion, course approvals, moderation, email outbox, audit log |
| `certificates.mjs` | eligibility, issuance, PDF generation and download |
| `accomplishments.mjs` | automatic certificates, badge awards, streaks, topic mastery, notifications, local email delivery |

### Authentication

- Access and refresh tokens are signed JWTs.
- Refresh tokens are stored hashed/server-side and rotated on use.
- Passwords use bcrypt.
- Role checks are enforced on the server for instructor/admin routes.
- Admin actions are written to `audit_logs`.
- Suspension invalidates refresh tokens immediately.

## 4. Data model

The SQLite schema contains 34 tables in four groups:

- **Identity:** `users`, `refresh_tokens`
- **Learning:** `courses`, `modules`, `lectures`, `enrollments`, `lecture_progress`, `notes`, `bookmarks`
- **Assessment:** `assignments`, `assignment_submissions`, `quizzes`, `quiz_questions`, `quiz_attempts`, `quiz_answers`, `certificates`, `topic_mastery`
- **Engagement and governance:** `badges`, `user_badges`, `streaks`, `discussions`, `discussion_posts`, `announcements`, `notifications`, `email_outbox`, `course_approvals`, `payments`, `audit_logs`
- **AI:** `ai_chat_sessions`, `ai_chat_messages`, `document_chunks`, `study_plans`, `flashcards`, `recommendations`

Foreign keys and unique constraints prevent duplicate enrollments and duplicate bookmarks. Indexes support course, user, and discussion lookups.

## 5. AI retrieval design

The AI tutor is intentionally deterministic and local:

1. Lecture transcripts are chunked and stored in `document_chunks`.
2. `server/ai.mjs` tokenizes the user question and course chunks.
3. Token overlap with a small exact-substring bonus ranks chunks.
4. The best chunks are returned as citations and used to compose the answer.
5. If no grounded chunk matches, the tutor says so instead of inventing an answer.

This keeps the demo offline-safe and makes source citations verifiable. The interface is isolated in `server/ai.mjs`, so a production deployment can replace the answer composer with an LLM while keeping the same retrieval and citation contract.

## 6. Recommendation design

`refreshRecommendations()` in `server/routes/learning.mjs` recalculates the student's next-course widget from real learning signals:

1. Topic mastery below 80% produces keyword affinity against course title/description/category.
2. Average quiz score selects the expected difficulty (beginner, intermediate, advanced).
3. Enrolled categories provide category affinity.
4. The ranked top three are persisted in `recommendations` with a human-readable reason and score.

This replaces static recommendation rows with an explainable local rule engine. A production build can add embedding similarity on top of the same contract.

## 7. Files and certificates

- Uploads are validated by extension and MIME type, size-limited, stored locally, and served from `/uploads`.
- Uploaded `.mp4`/`.webm` files are attached as the lecture video and rendered with the browser's native HTML5 controls; demo lectures use the custom progress player.
- Submitted files are scoped to the authenticated student/instructor request.
- Certificates are generated on demand with `pdf-lib`; the credential ID is persisted in SQLite.

## 8. Production hardening path

For a real deployment:

- Move SQLite to Postgres and use pgvector for embeddings.
- Move uploads to S3/GCS and serve through signed URLs.
- Replace local deterministic answers with an LLM plus retrieval guardrails.
- Add a queue for transcript ingestion and indexing.
- Use managed JWT secrets, HTTPS-only cookies or secure token storage, and CSRF protection where relevant.
- Add structured logs, metrics, tracing, and alerting.
- Add integration tests against the production database and object storage.

# PRD v1.0 Coverage Matrix

This document answers one question honestly: **how much of the LMS-AI PRD is actually built in this repository?**

The project is a complete **local functional demo** of the PRD's LMS and AI-tutor scope. It is not a production cloud deployment, and the production-only infrastructure in the PRD (PostgreSQL + pgvector, Redis/BullMQ, S3/MinIO, a separate FastAPI AI service, Anthropic API, HLS/CDN, SMTP, multi-tenancy) is intentionally replaced with a local, inspectable substitute instead of being faked.

**Verified locally:** 28/28 API smoke checks, TypeScript typecheck, production build, and browser QA for the main student, instructor, and admin flows.

---

## 1. Functional requirements

### Student module

| ID | PRD requirement | Local build | Evidence / boundary |
|---|---|---|---|
| FR-S1 | Register/login with email + password, JWT session | Done | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`; access + rotating refresh tokens |
| FR-S2 | Dashboard with enrolled courses, progress, streak | Done | `/dashboard/me`; live progress, streak, quiz average, recommendations, activity |
| FR-S3 | Catalog with category, difficulty, rating filters + search | Done | `/courses` plus search, category, difficulty, rating, price, sort, pagination; browser QA passed |
| FR-S4 | Video player with resume and playback speed | Done locally | Demo lectures use the custom player; uploaded `.mp4`/`.webm` files render in a native HTML5 player with native controls, resume, and speed. HLS/CDN is not built. |
| FR-S5 | Timestamped notes and bookmarks | Done | Notes CRUD and bookmark create/delete, both tied to lecture time |
| FR-S6 | Assignment upload (PDF/ZIP/code) before deadline | Done | Multer upload with extension/MIME validation, size limits, resubmission, deadline display |
| FR-S7 | MCQ, multi-select, short-answer with auto-grading | Done | Single-choice, multi-select, and normalized short-answer grading; review explanations |
| FR-S8 | Auto certificate PDF at 100% completion | Done | `syncCourseCompletion` issues a real `pdf-lib` certificate at 100% course completion; downloadable credential |
| FR-S9 | Badges for milestones | Done | First course, perfect score, quiz master, seven-day streak; idempotent awards |
| FR-S10 | Recommendations from quiz performance | Done | `GET /recommendations/me` recalculates from topic mastery, quiz average, category affinity, and difficulty fit; reason + score persisted |

### AI tutor module

| ID | PRD requirement | Local build | Evidence / boundary |
|---|---|---|---|
| FR-A1 | Course-scoped chat | Done | `POST /ai/chat` with course and session context |
| FR-A2 | RAG-grounded answers with citations | Done locally | Local token-overlap retrieval over `document_chunks`; every grounded answer returns lecture title, timestamp, and snippet. No external LLM is called. |
| FR-A3 | Lecture transcript summary | Done | `POST /ai/lectures/:id/summarize`; key points returned to the lesson UI |
| FR-A4 | Personalized study plan from quiz history | Done | `POST /ai/study-plan`; uses quiz attempts, mastery, and enrolled courses |
| FR-A5 | Auto-generate a 5-10 question quiz draft | Done | Instructor-only `POST /ai/lectures/:id/generate-quiz`; draft review/publish flow |
| FR-A6 | Beginner/intermediate/advanced explanations | Done | Mode switch persisted per AI session and applied by the answer composer |
| FR-A7 | Flashcards per module | Done | `POST /ai/modules/:id/flashcards`; stored and reviewable |
| FR-A8 | Per-topic mastery feeding difficulty | Done with manual mode control | Mastery is persisted after quiz attempts and feeds recommendations/study plans. Chat difficulty is user-selected rather than auto-switched. |

### Instructor module

| ID | PRD requirement | Local build | Evidence / boundary |
|---|---|---|---|
| FR-I1 | Create course with title, description, category, thumbnail, price | Done | Course authoring UI/API; cover upload or URL; status defaults to pending |
| FR-I2 | Upload video/PDF/slide material per lecture | Done locally | PDF, slide decks, source files, images, MP4/WebM; uploaded video is automatically attached as the lecture video. External video URLs also supported. No S3/HLS pipeline. |
| FR-I3 | Assignments with rubric and deadline | Done | Assignment create API/UI with instructions, rubric JSON, due date; grading and feedback |
| FR-I4 | Build or approve AI-generated quizzes | Done via approval path | AI quiz draft generation, instructor review, publish; manual quiz-builder form is not included |
| FR-I5 | Analytics: drop-off, average quiz score, time-on-task | Done | Instructor analytics shows learners, completion, average quiz score, per-lecture viewers/completions/average watched/drop-off |
| FR-I6 | Announcements for enrolled students | Done | Course announcement composer; student lesson page; in-app and local email notification |

### Admin module

| ID | PRD requirement | Local build | Evidence / boundary |
|---|---|---|---|
| FR-AD1 | Approve/reject pending courses | Done | Approval queue and decision API; instructor notified |
| FR-AD2 | View/suspend/delete users | Done | User directory, suspension, deletion with anonymization; sessions revoked; audit-safe |
| FR-AD3 | Platform metrics: DAU, enrollments, completion, revenue | Done | `/admin/overview`; seeded payment records for revenue |
| FR-AD4 | Assign/revoke roles | Done | Role update endpoint and UI; server-side RBAC |
| FR-AD5 | Moderate reported forum content | Done | Flagged-post queue, dismiss/resolve, audit log; instructors can moderate their own course threads |

---

## 2. Non-functional requirements

| Area | Status in this build | Honest boundary |
|---|---|---|
| Performance | Not load-tested | No p95 proof under 100 concurrent users; local API is fast but this is not a benchmark |
| Scalability | Single Node process | No stateless horizontal scale, load balancer, or read replica |
| Security | Implemented locally | bcrypt, short-lived JWT access + rotating refresh tokens, RBAC, validation, rate limits, security headers, upload checks |
| Data privacy | Partial | Audit logs exist, but SQLite PII is **not encrypted at rest** |
| Availability | Local demo only | No 99.5% SLA or managed deployment |
| Accessibility | Partial | Keyboard focus styles, labels, reduced-motion handling, responsive layout; no formal WCAG 2.1 AA audit |
| Observability | Basic | Health endpoint and request/error logs; no Prometheus, tracing, or centralized logging |
| Caching | Not implemented | No Redis; catalog reads hit SQLite |
| Rate limiting | Done | Auth, AI, and general API limits |
| Dark mode | Done | Dark-first design is the default; no light-theme toggle |
| i18n | Scaffolding done | English/Hindi toggle for navigation and application chrome; page content remains English (full translation is out of scope) |
| Containerization | Optional local image | `Dockerfile` + app-only `docker-compose.yml`; no Postgres/Redis/MinIO services |
| CI/CD | CI only | GitHub Actions runs typecheck, API tests, and build; no deploy job |
| Testing | API smoke suite | 28 isolated checks; no Jest/Supertest unit suite, Playwright E2E, or k6 load test |
| Payments | Seeded only | No payment gateway or subscription billing |
| Multi-tenancy | Not implemented | Single-tenant demo schema |

---

## 3. PRD stack vs local substitute

| PRD stack | Local substitute | Production migration seam |
|---|---|---|
| PostgreSQL 15+ | `node:sqlite` database at `server/data/vertexon.db` | Replace `server/db.mjs` and SQL with Postgres migrations |
| pgvector / embeddings | `document_chunks` + deterministic token-overlap retrieval | Add embedding column/index and an embedding provider |
| Redis + BullMQ | In-process work, SQLite state | Add Redis cache and a queue for ingestion/notifications |
| S3/MinIO | Local `uploads/` directory | Swap upload adapter for S3/GCS signed URLs |
| Python + FastAPI AI service | `server/ai.mjs` in the Node API | Extract the retrieval/answer contract into a separate service |
| Anthropic API | Local deterministic answer composer | Add an LLM provider behind the same citation contract |
| HLS via CDN | Custom demo player + native MP4/WebM playback | Add transcoding and HLS delivery |
| SMTP/SES | `email_outbox` + `server/data/mail-outbox.log` | Replace `queueEmail` with a real provider |
| React Query / Redux | Typed `src/lib/api.ts` + React Context | Add TanStack Query or a store if the app grows |
| Docker Compose with Postgres/Redis/MinIO | Optional app-only compose file | Add the real service topology |
| Managed cloud deploy | Local Vite + Express | Add container registry, staging, secrets, HTTPS, observability |

---

## 4. API compatibility notes

The local API is intentionally compact and follows the PRD's base path `/api/v1`, but it is not a byte-for-byte implementation of every sample route.

| PRD area | Local route shape |
|---|---|
| Auth | Same core paths: `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me` |
| Courses | `/courses`, `/courses/:id`, `/courses/:id/modules`, `/courses/modules/:id/lectures`, `/courses/:id/approve` |
| Learning | `/courses/:id/enroll`, `/enrollments/me`, `/lectures/:id/progress`, `/lectures/:id/notes`, `/lectures/:id/bookmarks` |
| Assignments | `/assignments`, `/assignments/:id/submit`, `/submissions/:id/grade` |
| Quizzes | `/quizzes/:id`, `/quizzes/:id/attempt`, `/attempts/:id/submit` |
| AI | Consolidated `/ai/chat`, `/ai/sessions/me`, `/ai/sessions/:id/messages`, `/ai/lectures/:id/summarize`, `/ai/lectures/:id/generate-quiz`, `/ai/modules/:id/flashcards`, `/ai/study-plan` |
| Admin | `/admin/overview`, `/admin/users`, `/admin/courses/pending`, `/admin/moderation/flagged`, `/admin/audit-logs` |

The PRD's standard error envelope is used: `{ "error": { "code", "message", "field?" } }`.

---

## 5. What is intentionally not built

These are production or post-4-week items, not hidden gaps:

- Live video classes / WebRTC / collaborative whiteboard
- Real-time peer study rooms
- Payment gateway, subscriptions, instructor payouts
- Native mobile apps
- Full multilingual translation
- Offline-first content sync
- AI plagiarism detection
- PostgreSQL/pgvector, Redis/BullMQ, S3/MinIO, FastAPI AI service, Anthropic API
- HLS transcoding/CDN
- Real SMTP/SES delivery
- Kubernetes/cloud deployment, secrets manager, Prometheus/Grafana, tracing
- Full multi-tenancy and tenant isolation
- Formal WCAG audit and load testing

---

## 6. Bottom line

**Haan - PRD ka local functional LMS-AI scope ban gaya hai.** Student, instructor, and admin workspaces work end-to-end; the AI tutor is genuinely course-grounded with citations; quizzes, assignments, certificates, badges, discussions, notifications, analytics, approvals, moderation, and i18n scaffolding are wired to real APIs and persisted data.

**Lekin ye production SaaS nahi hai.** Production database, vector store, queue, object storage, LLM provider, HLS/CDN, SMTP, payments, multi-tenancy, and cloud deployment are not implemented. They are documented above with the exact local substitute and migration seam, so the submission is honest about what runs today versus what would be built for production.

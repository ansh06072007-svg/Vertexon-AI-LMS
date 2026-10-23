# Submission Requirement Coverage

This file maps the LMS-AI brief to the implementation. All paths are relative to the project root.

| Requirement | Implementation | Status |
|---|---|---|
| Local end-to-end run | React SPA + Express + `node:sqlite`; `npm install && npm run dev` | Done |
| Authentication | JWT access tokens, rotating refresh tokens, bcrypt, login/register/logout | Done |
| RBAC | Server-side `roleRequired` guards; role-specific route trees in `App.tsx` | Done |
| Student dashboard | Live `/dashboard/me`, enrollment, streak, study target, recommendations | Done |
| Course catalog | Search, categories, difficulty/rating/price filters, sorting, enrollment, resume, progress | Done |
| Lesson delivery | Progress timer, completion, notes, bookmarks, transcript, summary, resources, announcements, Q&A | Done |
| Video delivery | Custom demo player; native MP4/WebM playback for uploaded video; resume + speed | Done locally |
| AI tutor | `/ai/chat`, local retrieval over `document_chunks`, cited sources, topic mastery context | Done |
| Quizzes | Single-choice, multi-select, and short-answer attempts; auto-grading; review explanations | Done |
| Assignments | Instructor create with rubric/deadline, student upload/resubmit, grade, feedback | Done |
| Certificates | Eligibility, manual issuance, automatic issuance at 100%, credential ID, real PDF download | Done |
| Badges/streaks/XP | Seeded gamification plus automatic milestone awards and persisted activity | Done |
| Discussions | Threads, replies, search, reporting, moderation | Done |
| Notifications | In-app notifications, unread count, read/read-all, local email outbox | Done |
| Instructor authoring | Create course, cover upload, modules, lectures, materials, video upload/URL, transcripts, AI quiz drafts | Done |
| Instructor analytics | Overview, analytics, roster, engagement, grading queue | Done |
| Admin governance | Approvals, user roles, suspension, deletion/anonymization, moderation, audit logs | Done |
| Recommendations | Dynamic ranking from topic mastery, quiz average, category affinity, difficulty fit | Done |
| i18n | English/Hindi toggle for navigation and application chrome, persisted in local storage | Scaffold done |
| Dark mode | Dark-first design is the default | Done |
| Security | Security headers, rate limits, upload validation, no-store API responses | Done |
| Tests | `npm run test:api` - 28 isolated API checks | 28/28 passing |
| Build | `npm run typecheck` and `npm run build` | Passing |
| Docs | README, architecture, compliance, PRD coverage, Dockerfile, compose, CI | Included |

The full requirement-by-requirement matrix is in `docs/PRD-COVERAGE.md`.

## Demo-only boundaries

The brief asked for a locally runnable submission build. The following production integrations are intentionally represented by the local stack or seeded flows:

- Payment provider: seeded `payments` records and enrollment pricing, no live gateway.
- Email delivery: in-app notifications plus a persisted local outbox/log (`server/data/mail-outbox.log`); no SMTP credentials are required. `queueEmail` is the production adapter seam.
- Video CDN/HLS: custom demo player plus native MP4/WebM playback for uploaded files; no managed HLS/CDN pipeline.
- External LLM: deterministic local retrieval/answer engine, no paid API dependency.
- Managed cloud infrastructure: optional app-only Dockerfile/compose, not a deployed environment.
- Data privacy: audit logs exist, but SQLite PII is not encrypted at rest.
- Accessibility/performance: focus states and responsive layout are implemented; no formal WCAG audit or load test.

These boundaries are documented in the README and `docs/PRD-COVERAGE.md` so reviewers can distinguish the working local demo from a production deployment.

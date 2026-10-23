# Deploying Vertexon.AI LMS on Render

## 1. Does this project need an AI API key?

**No.** There is no Gemini, OpenAI, Anthropic, or other LLM key in this project.

The AI Tutor uses local retrieval over `document_chunks` in `server/ai.mjs`. It is intentionally deterministic and offline-safe. On Render, the `API_KEY` field in the screenshot can be left **blank** (or removed).

There is no `.env` file with a secret AI key. The only secrets are the JWT signing secrets.

## 2. Render service settings

| Setting | Value |
|---|---|
| Service type | Web Service |
| Runtime | Node |
| Root directory | project root |
| Build command | `npm ci && npm run build` |
| Start command | `npm start` |
| Health check path | `/api/v1/health` |
| Node version | `24.21.0` (set `NODE_VERSION` below, or use `.node-version`) |

`npm start` serves both the built React app and the API from the same process.

## 3. Environment variables

### Required

| Key | Value | Why |
|---|---|---|
| `NODE_VERSION` | `24.21.0` | `node:sqlite` needs a modern Node runtime |
| `NODE_ENV` | `production` | Production runtime behavior |
| `HOST` | `0.0.0.0` | Render must reach the server from outside the container |
| `JWT_ACCESS_SECRET` | long random string | Signs access tokens |
| `JWT_REFRESH_SECRET` | different long random string | Signs refresh tokens |
| `JWT_ACCESS_TTL` | `2h` | Access-token lifetime |
| `JWT_REFRESH_TTL` | `7d` | Refresh-token lifetime |
| `JWT_REFRESH_DAYS` | `7` | Refresh-token retention |

Do **not** set `PORT` manually. Render injects `PORT` automatically, and `server/index.mjs` reads it.

For the JWT secrets, use Render's **Generate** button or a local command such as:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"
```

Generate two different values.

### Optional: persistent SQLite and uploads

Render's filesystem is **ephemeral** by default. Without a persistent disk:

- the SQLite database is recreated and reseeded on a restart/redeploy;
- uploaded files are lost on a restart/redeploy;
- this is fine for a short demo, but not for real user data.

For persistence, attach a Render persistent disk (paid instance type), mount it at `/var/data`, and add:

| Key | Value |
|---|---|
| `DB_PATH` | `/var/data/vertexon.db` |
| `UPLOAD_DIR` | `/var/data/uploads` |
| `MAIL_OUTBOX_LOG` | `/var/data/mail-outbox.log` |

If you do not attach a disk, omit these three variables.

### Not needed

| Key | Status |
|---|---|
| `OPENAI_API_KEY` | Not used |
| `GEMINI_API_KEY` | Not used |
| `ANTHROPIC_API_KEY` | Not used |
| `API_KEY` | Not used - leave blank |

## 4. After deploy

1. Open the Render URL.
2. Wait for the first boot; the empty database is seeded automatically.
3. Log in with a demo account:

| Role | Email | Password |
|---|---|---|
| Student | `ananya@vertexon.ai` | `Student123!` |
| Instructor | `rohit@vertexon.ai` | `Instructor123!` |
| Admin | `meera@vertexon.ai` | `Admin123!` |

4. Check `https://your-service.onrender.com/api/v1/health`. It should return `{"status":"ok"}`.

## 5. Important limits

- This is a **single-instance demo**. Do not scale it to multiple Render instances while using local SQLite and local uploads.
- Render free instances may sleep; the first request can be slow.
- The local email outbox writes to a file/table. It does not send real email.
- The AI tutor does not call a paid provider, so there is no AI usage bill.
- For production, migrate SQLite to Postgres, uploads to S3/GCS, and the local retrieval engine to a separately deployed AI service. The full matrix is in `docs/PRD-COVERAGE.md`.

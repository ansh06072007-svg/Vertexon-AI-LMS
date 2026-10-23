import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { schema } from './schema.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const dataDir = join(here, 'data');
export const uploadsDir = join(here, 'uploads');
mkdirSync(dataDir, { recursive: true });
mkdirSync(uploadsDir, { recursive: true });

export const dbPath = process.env.DB_PATH || join(dataDir, 'vertexon.db');
export const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL;');
db.exec(schema);

// SQLite does not add new columns to an existing table from CREATE TABLE IF NOT EXISTS.
// Keep the local demo database forward-compatible without requiring a destructive reset.
function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn('quiz_questions', 'correct_indexes_json', 'TEXT');
ensureColumn('quiz_questions', 'accepted_answers_json', 'TEXT');
ensureColumn('quiz_answers', 'selected_indexes_json', 'TEXT');
ensureColumn('quiz_answers', 'text_answer', 'TEXT');

export const now = () => new Date().toISOString();
export const id = (prefix = 'id') => `${prefix}-${crypto.randomUUID()}`;

export function recordAudit(actorId, action, entity, entityId, metadata = {}) {
  db.prepare(
    'INSERT INTO audit_logs (id, actor_id, action, entity, entity_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id('audit'), actorId, action, entity, entityId, JSON.stringify(metadata), now());
}

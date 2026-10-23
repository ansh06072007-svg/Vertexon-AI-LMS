import { rmSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, 'data');
const uploadsDir = join(here, 'uploads');

for (const name of ['vertexon.db', 'vertexon.db-wal', 'vertexon.db-shm']) {
  const file = join(dataDir, name);
  if (existsSync(file)) rmSync(file, { force: true });
}
if (existsSync(uploadsDir)) {
  for (const file of readdirSync(uploadsDir)) {
    if (file !== '.gitkeep') rmSync(join(uploadsDir, file), { force: true, recursive: true });
  }
}

console.log('Demo database and uploaded files reset.');
console.log('Run `npm run dev` (or `npm start` after building) to reseed.');

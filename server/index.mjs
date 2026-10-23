import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, dbPath, uploadsDir } from './db.mjs';
import { seedDatabase } from './seed.mjs';
import authRoutes from './routes/auth.mjs';
import courseRoutes from './routes/courses.mjs';
import learningRoutes from './routes/learning.mjs';
import quizRoutes from './routes/quizzes.mjs';
import aiRoutes from './routes/ai.mjs';
import instructorRoutes from './routes/instructor.mjs';
import adminRoutes from './routes/admin.mjs';
import certificateRoutes from './routes/certificates.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 5174);
const HOST = process.env.HOST || '127.0.0.1';

app.disable('x-powered-by');
app.disable('etag');
app.set('trust proxy', 1);
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

const buckets = new Map();
function rateLimit({ windowMs, max, name }) {
  return (req, res, next) => {
    const key = `${name}:${req.ip}`;
    const current = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= current) {
      buckets.set(key, { count: 1, resetAt: current + windowMs });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > max) {
      res.setHeader('Retry-After', Math.ceil((bucket.resetAt - current) / 1000));
      return res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment and try again.' },
      });
    }
    next();
  };
}

setInterval(() => {
  const current = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= current) buckets.delete(key);
  }
}, 60_000).unref();

app.use('/api/v1', rateLimit({ name: 'api', windowMs: 60_000, max: 600 }));
app.use('/api/v1/auth', rateLimit({ name: 'auth', windowMs: 60_000, max: 30 }));
app.use('/api/v1/ai', rateLimit({ name: 'ai', windowMs: 60_000, max: 40 }));

app.use('/uploads', express.static(uploadsDir, { maxAge: '1h' }));

app.get('/api/v1/health', (_req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({
      status: 'ok',
      service: 'vertexon-lms-api',
      database: 'sqlite',
      time: new Date().toISOString(),
    });
  } catch {
    res.status(500).json({ status: 'degraded', database: 'unavailable' });
  }
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/courses', courseRoutes);
app.use('/api/v1/quizzes', quizRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/instructor', instructorRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/certificates', certificateRoutes);
app.use('/api/v1', learningRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: { code: 'API_ROUTE_NOT_FOUND', message: 'API route not found.' } });
});

const distDir = join(here, '..', 'dist');
if (existsSync(join(distDir, 'index.html'))) {
  app.use(express.static(distDir, { maxAge: '1h' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(join(distDir, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  if (err?.name === 'MulterError') {
    return res.status(422).json({
      error: { code: 'UPLOAD_ERROR', message: err.message },
    });
  }
  if (String(err?.message || '').startsWith('Unsupported file type')) {
    return res.status(422).json({
      error: { code: 'UNSUPPORTED_FILE', message: err.message },
    });
  }
  console.error('[api] unhandled error:', err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on the server.' },
  });
});

const seed = await seedDatabase();
const server = app.listen(PORT, HOST, () => {
  console.log('');
  console.log('  Vertexon LMS API');
  console.log(`  Local API:  http://${HOST}:${PORT}/api/v1`);
  console.log(`  Health:     http://${HOST}:${PORT}/api/v1/health`);
  console.log(`  Database:   ${dbPath}`);
  console.log(`  Seed:       ${seed.seeded ? 'created demo workspace' : 'existing workspace loaded'}`);
  console.log('');
  console.log('  Demo logins:');
  console.log('    student    ananya@vertexon.ai / Student123!');
  console.log('    instructor rohit@vertexon.ai  / Instructor123!');
  console.log('    admin      meera@vertexon.ai  / Admin123!');
  console.log('');
});

const shutdown = () => {
  server.close(() => {
    try {
      db.close();
    } catch {
      // The database may already be closed by a signal race.
    }
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;

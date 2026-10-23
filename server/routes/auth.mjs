import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, id, now, recordAudit } from '../db.mjs';
import {
  authRequired,
  issueTokens,
  revokeRefreshToken,
  rotateRefreshToken,
  safeUser,
} from '../auth.mjs';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get('/demo-accounts', (_req, res) => {
  res.json({
    accounts: [
      {
        role: 'student',
        label: 'Ananya · Student',
        email: 'ananya@vertexon.ai',
        password: 'Student123!',
        description: '4 enrolled courses, 7-day streak, certificate ready.',
      },
      {
        role: 'instructor',
        label: 'Rohit · Instructor',
        email: 'rohit@vertexon.ai',
        password: 'Instructor123!',
        description: 'DSA and full-stack courses, submissions to grade.',
      },
      {
        role: 'admin',
        label: 'Meera · Admin',
        email: 'meera@vertexon.ai',
        password: 'Admin123!',
        description: 'Course approvals, user roles, platform analytics.',
      },
    ],
  });
});

router.post('/register', async (req, res, next) => {
  try {
    const fullName = String(req.body.full_name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (fullName.length < 2) {
      return res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'Full name must be at least 2 characters.', field: 'full_name' },
      });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'Enter a valid email address.', field: 'email' },
      });
    }
    if (password.length < 8) {
      return res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters.', field: 'password' },
      });
    }
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
      return res.status(409).json({
        error: { code: 'EMAIL_IN_USE', message: 'An account with this email already exists.', field: 'email' },
      });
    }

    const user = {
      id: id('user'),
      full_name: fullName,
      email,
      password_hash: await bcrypt.hash(password, 10),
      role: 'student',
      status: 'active',
      headline: 'New learner',
      avatar_url: null,
      created_at: now(),
    };
    db.prepare(
      `INSERT INTO users (id, full_name, email, password_hash, role, status, headline, avatar_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      user.id,
      user.full_name,
      user.email,
      user.password_hash,
      user.role,
      user.status,
      user.headline,
      user.avatar_url,
      user.created_at,
    );
    db.prepare('INSERT INTO streaks (user_id, current_streak, longest_streak, last_active_date) VALUES (?, 0, 0, ?)').run(
      user.id,
      new Date().toISOString().slice(0, 10),
    );
    recordAudit(user.id, 'user.registered', 'user', user.id, { role: 'student' });
    const tokens = issueTokens(user);
    res.status(201).json({ ...tokens, user: safeUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' },
      });
    }
    if (user.status !== 'active') {
      return res.status(403).json({
        error: { code: 'ACCOUNT_SUSPENDED', message: 'This account has been suspended. Contact an administrator.' },
      });
    }
    const tokens = issueTokens(user);
    recordAudit(user.id, 'auth.login', 'user', user.id, {});
    res.json({ ...tokens, user: safeUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', (req, res) => {
  const result = rotateRefreshToken(String(req.body.refresh_token || ''));
  if (!result) {
    return res.status(401).json({
      error: { code: 'REFRESH_INVALID', message: 'Refresh token is invalid or expired.' },
    });
  }
  res.json({ ...result.tokens, user: safeUser(result.user) });
});

router.post('/logout', (req, res) => {
  revokeRefreshToken(String(req.body.refresh_token || ''));
  res.status(204).end();
});

router.get('/me', authRequired, (req, res) => {
  const streak = db.prepare('SELECT * FROM streaks WHERE user_id = ?').get(req.user.id);
  const unread = db
    .prepare('SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0')
    .get(req.user.id);
  res.json({
    user: safeUser(req.user),
    streak: streak || { current_streak: 0, longest_streak: 0, last_active_date: null },
    unread_notifications: Number(unread.count),
  });
});

export default router;

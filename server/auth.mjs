import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { db, now } from './db.mjs';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'vertexon-dev-access-secret-change-me';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'vertexon-dev-refresh-secret-change-me';
const ACCESS_TTL = process.env.JWT_ACCESS_TTL || '2h';
const REFRESH_TTL = process.env.JWT_REFRESH_TTL || '7d';
const REFRESH_DAYS = Number(process.env.JWT_REFRESH_DAYS || 7);

export const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export function safeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    status: user.status,
    headline: user.headline,
    avatar_url: user.avatar_url,
    created_at: user.created_at,
  };
}

export function issueTokens(user) {
  const accessToken = jwt.sign(
    { sub: user.id, role: user.role, type: 'access' },
    ACCESS_SECRET,
    { expiresIn: ACCESS_TTL },
  );
  const refreshId = randomUUID();
  const refreshToken = jwt.sign(
    { sub: user.id, role: user.role, type: 'refresh', jti: refreshId },
    REFRESH_SECRET,
    { expiresIn: REFRESH_TTL },
  );
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked, created_at) VALUES (?, ?, ?, ?, 0, ?)',
  ).run(refreshId, user.id, hashToken(refreshToken), expiresAt, now());
  return { access_token: accessToken, refresh_token: refreshToken };
}

export function rotateRefreshToken(refreshToken) {
  let payload;
  try {
    payload = jwt.verify(refreshToken, REFRESH_SECRET);
  } catch {
    return null;
  }
  if (payload.type !== 'refresh') return null;
  const stored = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(hashToken(refreshToken));
  if (!stored || stored.revoked || stored.expires_at < now()) return null;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
  if (!user || user.status !== 'active') return null;
  db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?').run(stored.id);
  return { user, tokens: issueTokens(user) };
}

export function revokeRefreshToken(refreshToken) {
  if (!refreshToken) return;
  db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?').run(hashToken(refreshToken));
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
    });
  }
  try {
    const payload = jwt.verify(token, ACCESS_SECRET);
    if (payload.type !== 'access') throw new Error('Wrong token type');
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
    if (!user || user.status !== 'active') {
      return res.status(401).json({
        error: { code: 'ACCOUNT_INACTIVE', message: 'This account is not active.' },
      });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({
      error: { code: 'TOKEN_INVALID', message: 'Session expired. Please log in again.' },
    });
  }
}

export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, ACCESS_SECRET);
      if (payload.type === 'access') {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
        if (user && user.status === 'active') req.user = user;
      }
    } catch {
      // Public routes should continue even when an expired token is supplied.
    }
  }
  next();
}

export function roleRequired(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: `This action requires one of: ${roles.join(', ')}.` },
      });
    }
    next();
  };
}

import type Router from '@koa/router';
import crypto from 'node:crypto';
import type { Pool } from 'pg';

export interface UserSession {
  id: string;
  username: string;
  email: string;
  isGuest: boolean;
  createdAt: number;
}

export interface StoredSession {
  user: UserSession;
  sessionToken: string;
  expiresAt: number;
}

export interface MagicLinkToken {
  token: string;
  email: string;
  username: string;
  expiresAt: number;
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// In-memory fallback stores
const memoryMagicTokens = new Map<string, MagicLinkToken>();
const memorySessions = new Map<string, StoredSession>(); // sessionToken -> StoredSession
const rateLimitMap = new Map<string, RateLimitRecord>(); // ip/email -> RateLimitRecord

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAGIC_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_MAGIC_REQUESTS_PER_WINDOW = 5;

/**
 * Clean up expired magic link tokens and expired sessions
 */
export function pruneExpiredAuthData(): void {
  const now = Date.now();
  for (const [key, val] of memoryMagicTokens.entries()) {
    if (val.expiresAt <= now) {
      memoryMagicTokens.delete(key);
    }
  }
  for (const [key, val] of memorySessions.entries()) {
    if (val.expiresAt <= now) {
      memorySessions.delete(key);
    }
  }
  for (const [key, val] of rateLimitMap.entries()) {
    if (val.resetAt <= now) {
      rateLimitMap.delete(key);
    }
  }
}

/**
 * Check and record rate limit for an identifier (IP or email)
 */
function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || record.resetAt <= now) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_MAGIC_REQUESTS_PER_WINDOW) {
    return false;
  }

  record.count += 1;
  return true;
}

/**
 * Register Magic Link and Auth routes on Koa router
 */
export function registerAuthRoutes(router: Router<any, any>, _dbPool?: Pool): void {
  // 1. Request Magic Link
  router.post('/api/auth/magic-link', async (ctx) => {
    const body = (ctx.request as any).body || {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const username = typeof body.username === 'string' ? body.username.trim().slice(0, 30) : '';
    const clientIp = ctx.ip || ctx.request.ip || '127.0.0.1';

    if (!email || !EMAIL_REGEX.test(email)) {
      ctx.status = 400;
      ctx.body = { error: { message: 'Please enter a valid email address (e.g. name@example.com).' } };
      return;
    }

    pruneExpiredAuthData();

    // Rate limit check
    if (!checkRateLimit(`ip_${clientIp}`) || !checkRateLimit(`email_${email}`)) {
      ctx.status = 429;
      ctx.body = { error: { message: 'Too many login requests. Please wait a few minutes before trying again.' } };
      return;
    }

    const finalUsername = username || email.split('@')[0].slice(0, 20);
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + MAGIC_TOKEN_TTL_MS;

    memoryMagicTokens.set(token, {
      token,
      email,
      username: finalUsername,
      expiresAt
    });

    console.log(`[Auth] Magic link generated for ${email} (${finalUsername}).`);

    // In production, token is sent via email and NEVER leaked in JSON response.
    // In dev / test environments (or when ALLOW_DEV_MAGIC_LOGIN is set), we provide the token for 1-click test login.
    const isDev = process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_MAGIC_LOGIN === 'true';

    ctx.status = 200;
    ctx.body = {
      success: true,
      message: 'Magic link generated successfully.',
      expiresInMinutes: 15,
      ...(isDev
        ? {
            token,
            simulatedUrl: `/auth/verify?token=${token}`
          }
        : {})
    };
  });

  // 2. Verify Magic Link Token & Authenticate
  router.post('/api/auth/verify', async (ctx) => {
    const body = (ctx.request as any).body || {};
    const token = typeof body.token === 'string' ? body.token.trim() : '';

    if (!token) {
      ctx.status = 400;
      ctx.body = { error: { message: 'Token is required.' } };
      return;
    }

    pruneExpiredAuthData();
    const magicRecord = memoryMagicTokens.get(token);

    if (!magicRecord || magicRecord.expiresAt < Date.now()) {
      ctx.status = 401;
      ctx.body = { error: { message: 'Invalid or expired magic link. Please request a new one.' } };
      return;
    }

    // Burn token on successful consumption
    memoryMagicTokens.delete(token);

    // Create or retrieve user
    const userId = `u_${crypto.createHash('sha256').update(magicRecord.email).digest('hex').slice(0, 12)}`;
    const user: UserSession = {
      id: userId,
      username: magicRecord.username,
      email: magicRecord.email,
      isGuest: false,
      createdAt: Date.now()
    };

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + SESSION_TTL_MS;

    memorySessions.set(sessionToken, {
      user,
      sessionToken,
      expiresAt
    });

    console.log(`[Auth] User authenticated successfully: ${user.username} (${user.email})`);

    ctx.status = 200;
    ctx.body = {
      success: true,
      sessionToken,
      user
    };
  });

  // 3. Get Current User Profile via Session Token
  router.get('/api/auth/me', async (ctx) => {
    const authHeader = ctx.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (!token) {
      ctx.status = 401;
      ctx.body = { error: { message: 'Unauthorized or session token missing.' } };
      return;
    }

    pruneExpiredAuthData();
    const stored = memorySessions.get(token);

    if (!stored || stored.expiresAt <= Date.now()) {
      if (stored) {
        memorySessions.delete(token);
      }
      ctx.status = 401;
      ctx.body = { error: { message: 'Session expired. Please sign in again.' } };
      return;
    }

    ctx.status = 200;
    ctx.body = { user: stored.user };
  });

  // 4. Logout / Invalidate Session
  router.post('/api/auth/logout', async (ctx) => {
    const authHeader = ctx.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (token) {
      memorySessions.delete(token);
    }

    ctx.status = 200;
    ctx.body = { success: true, message: 'Logged out successfully.' };
  });
}

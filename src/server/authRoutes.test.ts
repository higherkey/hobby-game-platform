import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerAuthRoutes } from './authRoutes';

describe('authRoutes', () => {
  let mockRouter: any;
  let routes: Record<string, { method: string; handler: any }>;

  beforeEach(() => {
    routes = {};
    mockRouter = {
      get: vi.fn((path, ...handlers) => {
        routes[`GET ${path}`] = {
          method: 'GET',
          handler: handlers[handlers.length - 1]
        };
      }),
      post: vi.fn((path, ...handlers) => {
        routes[`POST ${path}`] = {
          method: 'POST',
          handler: handlers[handlers.length - 1]
        };
      })
    };
    registerAuthRoutes(mockRouter);
  });

  it('rejects invalid email formats on magic link request', async () => {
    const invalidEmails = ['invalid-email', 'foo@', '@bar.com', 'a@b'];
    for (const email of invalidEmails) {
      const ctx: any = {
        request: { body: { email, username: 'Test' } },
        ip: '127.0.0.1',
        status: 200,
        body: null
      };

      await routes['POST /api/auth/magic-link'].handler(ctx);
      expect(ctx.status).toBe(400);
      expect(ctx.body.error.message).toContain('valid email');
    }
  });

  it('generates magic link token for valid email in dev mode', async () => {
    const ctx: any = {
      request: { body: { email: 'player@example.com', username: 'BoardGamer' } },
      ip: '127.0.0.1',
      status: 200,
      body: null
    };

    await routes['POST /api/auth/magic-link'].handler(ctx);
    expect(ctx.status).toBe(200);
    expect(ctx.body.success).toBe(true);
    expect(ctx.body.token).toBeDefined();
    expect(ctx.body.simulatedUrl).toContain('/auth/verify?token=');
  });

  it('verifies valid magic link token and returns user and sessionToken', async () => {
    // 1. Generate token
    const magicCtx: any = {
      request: { body: { email: 'alice@tabletop.com', username: 'Alice' } },
      ip: '127.0.0.2',
      status: 200,
      body: null
    };
    await routes['POST /api/auth/magic-link'].handler(magicCtx);
    const token = magicCtx.body.token;

    // 2. Verify token
    const verifyCtx: any = {
      request: { body: { token } },
      status: 200,
      body: null
    };
    await routes['POST /api/auth/verify'].handler(verifyCtx);

    expect(verifyCtx.status).toBe(200);
    expect(verifyCtx.body.success).toBe(true);
    expect(verifyCtx.body.user.username).toBe('Alice');
    expect(verifyCtx.body.user.email).toBe('alice@tabletop.com');
    expect(verifyCtx.body.user.isGuest).toBe(false);
    expect(verifyCtx.body.sessionToken).toBeDefined();

    // 3. Token cannot be reused (one-time burn)
    const reuseCtx: any = {
      request: { body: { token } },
      status: 200,
      body: null
    };
    await routes['POST /api/auth/verify'].handler(reuseCtx);
    expect(reuseCtx.status).toBe(401);

    // 4. Check me route with sessionToken
    const meCtx: any = {
      headers: { authorization: `Bearer ${verifyCtx.body.sessionToken}` },
      status: 200,
      body: null
    };
    await routes['GET /api/auth/me'].handler(meCtx);
    expect(meCtx.status).toBe(200);
    expect(meCtx.body.user.username).toBe('Alice');

    // 5. Logout
    const logoutCtx: any = {
      headers: { authorization: `Bearer ${verifyCtx.body.sessionToken}` },
      status: 200,
      body: null
    };
    await routes['POST /api/auth/logout'].handler(logoutCtx);
    expect(logoutCtx.status).toBe(200);

    // 6. Session now invalidated
    const postLogoutMeCtx: any = {
      headers: { authorization: `Bearer ${verifyCtx.body.sessionToken}` },
      status: 200,
      body: null
    };
    await routes['GET /api/auth/me'].handler(postLogoutMeCtx);
    expect(postLogoutMeCtx.status).toBe(401);
  });
});

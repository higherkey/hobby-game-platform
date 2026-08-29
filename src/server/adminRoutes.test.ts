import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerAdminRoutes, verifyAdminToken } from './adminRoutes';

describe('adminRoutes', () => {
  let mockRouter: any;
  let mockDb: any;
  let mockTransport: any;
  let mockGames: any[];
  let routes: Record<string, { method: string; handler: any; middlewares: any[] }>;

  beforeEach(() => {
    routes = {};
    mockRouter = {
      get: vi.fn((path, ...handlers) => {
        routes[`GET ${path}`] = {
          method: 'GET',
          middlewares: handlers.slice(0, -1),
          handler: handlers[handlers.length - 1]
        };
      }),
      post: vi.fn((path, ...handlers) => {
        routes[`POST ${path}`] = {
          method: 'POST',
          middlewares: handlers.slice(0, -1),
          handler: handlers[handlers.length - 1]
        };
      }),
      delete: vi.fn((path, ...handlers) => {
        routes[`DELETE ${path}`] = {
          method: 'DELETE',
          middlewares: handlers.slice(0, -1),
          handler: handlers[handlers.length - 1]
        };
      })
    };

    mockDb = {
      listAllRoomsDetails: vi.fn().mockResolvedValue([
        {
          id: 'room_1',
          gameName: 'so-clover',
          unlisted: false,
          isGameover: false,
          createdAt: 1000,
          updatedAt: 2000,
          players: [{ id: '0', name: 'Alice' }]
        }
      ]),
      wipe: vi.fn().mockResolvedValue(undefined),
      createMatch: vi.fn().mockResolvedValue(undefined),
      cleanupStaleMatches: vi.fn().mockResolvedValue({ deletedCount: 2, deletedIds: ['r1', 'r2'] })
    };

    mockTransport = {
      io: {
        emit: vi.fn()
      }
    };

    mockGames = [
      {
        name: 'so-clover',
        setup: vi.fn().mockReturnValue({ count: 0 })
      }
    ];

    registerAdminRoutes({
      router: mockRouter,
      db: mockDb,
      games: mockGames,
      serverTransport: mockTransport
    });
  });

  it('validates admin tokens correctly', () => {
    expect(verifyAdminToken('dev-admin-secret')).toBe(true);
    expect(verifyAdminToken('wrong-secret')).toBe(false);
    expect(verifyAdminToken(undefined)).toBe(false);
  });

  it('authenticates admin token on POST /api/admin/auth', async () => {
    const authRoute = routes['POST /api/admin/auth'];
    expect(authRoute).toBeDefined();

    const validCtx: any = {
      request: { body: { token: 'dev-admin-secret' } },
      headers: {}
    };
    await authRoute.handler(validCtx);
    expect(validCtx.status).toBe(200);
    expect(validCtx.body.success).toBe(true);

    const invalidCtx: any = {
      request: { body: { token: 'wrong-token' } },
      headers: {}
    };
    await authRoute.handler(invalidCtx);
    expect(invalidCtx.status).toBe(401);
    expect(invalidCtx.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('blocks unauthorized access to GET /api/admin/rooms', async () => {
    const getRoomsRoute = routes['GET /api/admin/rooms'];
    expect(getRoomsRoute).toBeDefined();
    expect(getRoomsRoute.middlewares.length).toBeGreaterThan(0);

    const authMiddleware = getRoomsRoute.middlewares[0];
    const unauthorizedCtx: any = { headers: {} };
    const nextFn = vi.fn();

    await authMiddleware(unauthorizedCtx, nextFn);
    expect(unauthorizedCtx.status).toBe(401);
    expect(nextFn).not.toHaveBeenCalled();
  });

  it('returns room details on GET /api/admin/rooms when authorized', async () => {
    const getRoomsRoute = routes['GET /api/admin/rooms'];
    const ctx: any = {
      headers: { 'x-admin-token': 'dev-admin-secret' }
    };

    await getRoomsRoute.handler(ctx);
    expect(ctx.status).toBe(200);
    expect(ctx.body.data).toHaveLength(1);
    expect(ctx.body.data[0].id).toBe('room_1');
  });

  it('terminates room and broadcasts socket event on DELETE /api/admin/rooms/:id', async () => {
    const deleteRoute = routes['DELETE /api/admin/rooms/:id'];
    const ctx: any = {
      params: { id: 'room_1' },
      headers: { 'x-admin-token': 'dev-admin-secret' }
    };

    await deleteRoute.handler(ctx);
    expect(ctx.status).toBe(200);
    expect(mockDb.wipe).toHaveBeenCalledWith('room_1');
    expect(mockTransport.io.emit).toHaveBeenCalledWith('match_terminated', { matchID: 'room_1' });
  });

  it('executes manual cleanup on POST /api/admin/cleanup', async () => {
    const cleanupRoute = routes['POST /api/admin/cleanup'];
    const ctx: any = {
      request: { body: { inactivityTtlMs: 3600000 } },
      headers: { 'x-admin-token': 'dev-admin-secret' }
    };

    await cleanupRoute.handler(ctx);
    expect(ctx.status).toBe(200);
    expect(mockDb.cleanupStaleMatches).toHaveBeenCalledWith(3600000, 7200000);
    expect(ctx.body.deletedCount).toBe(2);
  });
});

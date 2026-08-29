import type Router from '@koa/router';
import type { PostgresStore } from './db/PostgresStore';
import { nanoid } from 'nanoid';
import type { Game } from 'boardgame.io';

export interface AdminRoutesConfig {
  router: Router<any, any>;
  db?: PostgresStore;
  games: Game<any, any>[];
  serverTransport?: any;
}

export const getAdminSecret = (): string => {
  return process.env.ADMIN_SECRET || 'dev-admin-secret';
};

export const verifyAdminToken = (token?: string): boolean => {
  if (!token) return false;
  return token === getAdminSecret();
};

export function registerAdminRoutes(config: AdminRoutesConfig): void {
  const { router, db, games, serverTransport } = config;

  // Admin Token Verification Middleware
  const requireAdmin = async (ctx: any, next: () => Promise<any>) => {
    const authHeader =
      ctx.headers?.['x-admin-token'] ||
      ctx.headers?.authorization?.replace(/^Bearer\s+/i, '');
    const token =
      (typeof authHeader === 'string' ? authHeader : undefined) ||
      (ctx.query?.token as string | undefined);

    if (!verifyAdminToken(token)) {
      ctx.status = 401;
      ctx.body = {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or missing admin authentication token.',
          details: []
        }
      };
      return;
    }
    await next();
  };

  // POST /api/admin/auth — Test / Validate Admin Token
  router.post('/api/admin/auth', async (ctx) => {
    const body = (ctx.request as any).body || {};
    const token = body.token || ctx.headers['x-admin-token'];

    if (!verifyAdminToken(token)) {
      ctx.status = 401;
      ctx.body = {
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'The provided admin token is invalid.',
          details: []
        }
      };
      return;
    }

    ctx.status = 200;
    ctx.body = { success: true, message: 'Admin authentication successful.' };
  });

  // GET /api/admin/rooms — List All Active & Stale Rooms
  router.get('/api/admin/rooms', requireAdmin, async (ctx) => {
    try {
      if (db && typeof db.listAllRoomsDetails === 'function') {
        const rooms = await db.listAllRoomsDetails();
        ctx.status = 200;
        ctx.body = {
          data: rooms,
          total: rooms.length,
          storage: 'postgres'
        };
        return;
      }

      // Fallback for InMemory mode
      const matchIDs = db ? await db.listMatches() : [];
      const rooms = [];
      for (const id of matchIDs) {
        const { metadata } = (await db?.fetch(id, { metadata: true })) || {};
        if (metadata) {
          rooms.push({
            id,
            gameName: metadata.gameName || 'unknown',
            unlisted: !!metadata.unlisted,
            isGameover: metadata.gameover !== undefined && metadata.gameover !== null,
            createdAt: metadata.createdAt || Date.now(),
            updatedAt: metadata.updatedAt || Date.now(),
            players: Object.entries<any>(metadata.players || {}).map(([pid, p]) => ({
              id: pid,
              name: p.name,
              isConnected: p.isConnected
            }))
          });
        }
      }

      ctx.status = 200;
      ctx.body = {
        data: rooms,
        total: rooms.length,
        storage: 'in-memory'
      };
    } catch (err) {
      console.error('[Admin] Failed to list rooms:', err);
      ctx.status = 500;
      ctx.body = {
        error: {
          code: 'ROOM_LIST_ERROR',
          message: 'Failed to retrieve room details.',
          details: []
        }
      };
    }
  });

  // DELETE /api/admin/rooms/:id — Kill / Delete a Room
  router.delete('/api/admin/rooms/:id', requireAdmin, async (ctx) => {
    const matchID = ctx.params.id;
    try {
      // Broadcast termination notice to connected sockets
      try {
        if (serverTransport?.io) {
          serverTransport.io.emit('match_terminated', { matchID });
        }
      } catch (socketErr) {
        console.warn('[Admin] Sockets termination broadcast warning:', socketErr);
      }

      if (db) {
        await db.wipe(matchID);
      }

      ctx.status = 200;
      ctx.body = {
        success: true,
        matchID,
        message: `Room ${matchID} was successfully terminated.`
      };
    } catch (err) {
      console.error(`[Admin] Failed to terminate room ${matchID}:`, err);
      ctx.status = 500;
      ctx.body = {
        error: {
          code: 'ROOM_TERMINATION_ERROR',
          message: `Failed to terminate room ${matchID}.`,
          details: []
        }
      };
    }
  });

  // POST /api/admin/rooms — Manually Create a Room
  router.post('/api/admin/rooms', requireAdmin, async (ctx) => {
    const body = (ctx.request as any).body || {};
    const gameName = typeof body.gameName === 'string' ? body.gameName.trim() : 'so-clover';
    const numPlayers = Math.min(Math.max(1, Number(body.numPlayers) || 2), 6);
    const unlisted = Boolean(body.unlisted);

    const game = games.find((g) => g.name === gameName);
    if (!game) {
      ctx.status = 400;
      ctx.body = {
        error: {
          code: 'INVALID_GAME',
          message: `Game '${gameName}' is not registered on this server.`,
          details: []
        }
      };
      return;
    }

    try {
      const matchID = nanoid(11);
      const now = Date.now();
      const players: Record<string, any> = {};
      for (let i = 0; i < numPlayers; i++) {
        players[String(i)] = { id: i };
      }

      const metadata: any = {
        gameName,
        players,
        unlisted,
        createdAt: now,
        updatedAt: now
      };

      const ctxObj: any = {
        numPlayers,
        playOrder: Array.from({ length: numPlayers }, (_, i) => String(i)),
        playOrderPos: 0
      };

      const initialG = typeof game.setup === 'function' ? game.setup(ctxObj, body.setupData) : {};
      const initialState = {
        G: initialG,
        ctx: ctxObj,
        _stateID: 0,
        _undo: [],
        _redo: [],
        plugins: {}
      };

      if (db) {
        await db.createMatch(matchID, {
          initialState: initialState as any,
          metadata
        });
      }

      ctx.status = 201;
      ctx.body = {
        success: true,
        matchID,
        gameName,
        numPlayers,
        unlisted,
        createdAt: now
      };
    } catch (err) {
      console.error('[Admin] Failed to manually create room:', err);
      ctx.status = 500;
      ctx.body = {
        error: {
          code: 'ROOM_CREATION_ERROR',
          message: 'Failed to create room.',
          details: []
        }
      };
    }
  });

  // POST /api/admin/cleanup — Trigger Stale Rooms Cleanup
  router.post('/api/admin/cleanup', requireAdmin, async (ctx) => {
    const body = (ctx.request as any).body || {};
    const inactivityTtl = Number(body.inactivityTtlMs) || 24 * 60 * 60 * 1000;
    const gameOverTtl = Number(body.gameOverTtlMs) || 2 * 60 * 60 * 1000;

    try {
      let deletedCount = 0;
      let deletedIds: string[] = [];

      if (db && typeof db.cleanupStaleMatches === 'function') {
        const res = await db.cleanupStaleMatches(inactivityTtl, gameOverTtl);
        deletedCount = res.deletedCount;
        deletedIds = res.deletedIds;
      }

      ctx.status = 200;
      ctx.body = {
        success: true,
        deletedCount,
        deletedIds,
        message: `Cleaned up ${deletedCount} stale room(s).`
      };
    } catch (err) {
      console.error('[Admin] Cleanup failed:', err);
      ctx.status = 500;
      ctx.body = {
        error: {
          code: 'CLEANUP_ERROR',
          message: 'Failed to run stale room cleanup.',
          details: []
        }
      };
    }
  });
}

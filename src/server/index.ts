import { Origins } from 'boardgame.io/server';
import { BaseServer } from '../core/Server';
import { SoCloverGame } from '../games/so-clover/game';
import { CounterGame } from '../core/example';
import { PostgresStore } from './db/PostgresStore';
import { recordCompletedGame, getGameHistory } from './gameRecordsHook';
import { registerAdminRoutes } from './adminRoutes';
import { registerTelemetryRoutes, recordServerLog } from './telemetryRoutes';
import send from 'koa-send';
import path from 'node:path';
import fs from 'node:fs';

const PORT = Number(process.env.PORT) || 8000;

const cloverGame = new SoCloverGame();
const counterGame = new CounterGame();

const allowedOrigins: (string | RegExp | boolean)[] = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
  : ['*', Origins.LOCALHOST, Origins.LOCALHOST_IN_DEVELOPMENT];

let db: PostgresStore | undefined;

if (process.env.DATABASE_URL) {
  console.log('[Server] Connecting to PostgreSQL database...');
  db = new PostgresStore({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    onGameOver: async (matchID, gameName, state, metadata) => {
      if (db) {
        await recordCompletedGame(db.pool, matchID, gameName, state, metadata);
      }
    }
  });
} else {
  console.log('[Server] No DATABASE_URL provided. Running with in-memory storage.');
}

// Create and start boardgame.io multiplayer server for all platform games
const { server, transport, normalizedGames, run } = BaseServer.createServer([cloverGame, counterGame], {
  port: PORT,
  origins: allowedOrigins,
  db
});

// Request tracing middleware
if (server.app) {
  server.app.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;
    if (ctx.path.startsWith('/api') || ctx.path.startsWith('/games') || ctx.path.startsWith('/health')) {
      const msg = `${ctx.method} ${ctx.path} -> ${ctx.status} (${duration}ms)`;
      recordServerLog(ctx.status >= 400 ? 'WARN' : 'INFO', 'HTTP', msg, {
        method: ctx.method,
        path: ctx.path,
        status: ctx.status,
        durationMs: duration
      });
    }
  });
}

// Register history API endpoint
if (server.router) {
  server.router.get('/api/history', async (ctx) => {
    if (!db) {
      ctx.status = 200;
      ctx.body = {
        data: [],
        pagination: { limit: 20, offset: 0, total: 0 },
        message: 'Persistent game history requires a PostgreSQL database.'
      };
      return;
    }

    const rawGameName = ctx.query.gameName;
    const gameName =
      typeof rawGameName === 'string' && rawGameName.trim().length > 0
        ? rawGameName.trim().slice(0, 100)
        : undefined;

    const limit = Math.min(Math.max(1, Number(ctx.query.limit) || 20), 100);
    const offset = Math.max(0, Number(ctx.query.offset) || 0);

    try {
      const { records, pagination } = await getGameHistory(db.pool, { gameName, limit, offset });
      ctx.status = 200;
      ctx.body = {
        data: records,
        pagination
      };
    } catch (err) {
      console.error('[Server] Failed to query history:', err);
      ctx.status = 500;
      ctx.body = {
        error: {
          code: 'DATABASE_QUERY_ERROR',
          message: 'Failed to retrieve game history records from the database.',
          details: []
        }
      };
    }
  });

  // Register Admin & Telemetry API routes
  registerAdminRoutes({
    router: server.router,
    db,
    games: normalizedGames,
    serverTransport: transport
  });
  registerTelemetryRoutes(server.router);

  // Direct router routes for production frontend
  const distPath = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(distPath)) {
    console.log(`[Server] Mounting static production frontend from ${distPath}`);
    const indexHtmlPath = path.join(distPath, 'index.html');

    server.router.get('/', async (ctx) => {
      ctx.type = 'text/html; charset=utf-8';
      ctx.body = fs.createReadStream(indexHtmlPath);
    });

    server.router.get('/assets/(.*)', async (ctx) => {
      await send(ctx, ctx.path, { root: distPath });
    });

    server.router.get('/favicon.ico', async (ctx) => {
      const fav = path.join(distPath, 'favicon.ico');
      if (fs.existsSync(fav)) {
        await send(ctx, 'favicon.ico', { root: distPath });
      } else {
        ctx.status = 204;
      }
    });
  } else {
    console.log('[Server] No dist/ directory found. Static frontend serving is inactive.');
  }
}

// Background cleanup job: runs every 15 minutes to prune inactive rooms
let cleanupTimer: NodeJS.Timeout | undefined;

if (db) {
  const runCleanup = async () => {
    try {
      console.log('[Server] Running automated stale rooms cleanup...');
      const res = await db!.cleanupStaleMatches();
      if (res.deletedCount > 0) {
        console.log(`[Server] Automated cleanup removed ${res.deletedCount} stale room(s).`);
      }
    } catch (err) {
      console.warn('[Server] Automated stale rooms cleanup error:', err);
    }
  };

  // Run initial cleanup after 1 minute, then every 15 minutes
  setTimeout(runCleanup, 60_000);
  cleanupTimer = setInterval(runCleanup, 15 * 60 * 1000);
}

// Graceful shutdown handling
const shutdown = async () => {
  console.log('[Server] Gracefully shutting down...');
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
  }
  if (db) {
    try {
      await db.close();
      console.log('[Server] Database pool closed.');
    } catch (err) {
      console.error('[Server] Error closing database pool:', err);
    }
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function startServer() {
  if (db) {
    const maxRetries = 3;
    let connected = false;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Server] Running database migrations (attempt ${attempt}/${maxRetries})...`);
        await db.connect();
        console.log('[Server] Database connected and schema ready.');
        connected = true;
        break;
      } catch (err) {
        console.error(`[Server] Database connection attempt ${attempt} failed:`, err);
        if (attempt < maxRetries) {
          console.log('[Server] Retrying database connection in 1.5s...');
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    }

    if (!connected) {
      console.warn('[Server] Starting server without database connection. Fallback in-memory behavior will be used.');
    }
  }
  run();
}

startServer();

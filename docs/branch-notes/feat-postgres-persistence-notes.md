# Branch Notes: feat/postgres-persistence

## 1. Discoveries & Deviations
- `boardgame.io/server` supports async custom storage engines via the `Async` class interface.
- `render.yaml` already provides the `DATABASE_URL` environment variable linked to `hobby-game-db`.
- Using `pg` (node-postgres) with connection pooling (`max: 5`) and `ssl: { rejectUnauthorized: false }` fits Render's PostgreSQL instance.
- Separated `PostgresStore` (generic boardgame.io storage adapter) from `gameRecordsHook.ts` (game-specific `onGameover` score & statistics archiving).
- Projected selective columns in `PostgresStore.fetch` to avoid fetching large `log` JSONB arrays when only `state` or `metadata` is requested.
- Implemented paginated history retrieval (`/api/history`) with strict bounds checking (`1 <= limit <= 100`) and standardized machine-readable error formatting.

## 2. Blockers & Risks (4a)
- Render PostgreSQL instances in production enforce SSL mode (`rejectUnauthorized: false`). Configured in connection pool options.
- Connection limit on Render free tier managed with `max: 5` pool size and graceful shutdown on `SIGTERM`/`SIGINT`.

## 3. Out-of-Scope Opportunities (4b)
- Frontend history viewer / leaderboard UI tab in Lobby.
- Post-game replay viewer using stored `log` / action deltas.

import pg from 'pg';
import type { State, Server, LogEntry } from 'boardgame.io';

const { Pool } = pg;

export enum StorageType {
  SYNC = 0,
  ASYNC = 1
}

export interface FetchOpts {
  state?: boolean;
  log?: boolean;
  metadata?: boolean;
  initialState?: boolean;
}

export interface FetchResult {
  state?: State;
  log?: LogEntry[];
  metadata?: Server.MatchData;
  initialState?: State;
}

export interface ListMatchesOpts {
  gameName?: string;
  where?: {
    isGameover?: boolean;
    updatedBefore?: number;
    updatedAfter?: number;
  };
}

export interface CreateMatchOpts {
  initialState: State;
  metadata: Server.MatchData;
}

export interface PostgresStoreConfig {
  connectionString?: string;
  max?: number;
  ssl?: boolean | pg.PoolConfig['ssl'];
  pool?: pg.Pool;
  onGameOver?: (matchID: string, gameName: string, state: State, metadata?: Server.MatchData) => Promise<void> | void;
}

/**
 * PostgresStore implements the boardgame.io Async database adapter interface
 * using native pg connection pooling and JSONB storage.
 */
export class PostgresStore {
  public readonly pool: pg.Pool;
  public readonly onGameOver?: (matchID: string, gameName: string, state: State, metadata?: Server.MatchData) => Promise<void> | void;

  constructor(configOrUrl: string | PostgresStoreConfig) {
    if (typeof configOrUrl === 'string') {
      const isProduction = process.env.NODE_ENV === 'production';
      const needsSsl = isProduction || configOrUrl.includes('sslmode=require') || configOrUrl.includes('render.com');

      this.pool = new Pool({
        connectionString: configOrUrl,
        max: 5,
        ssl: needsSsl ? { rejectUnauthorized: false } : undefined
      });
    } else if (configOrUrl.pool) {
      this.pool = configOrUrl.pool;
      this.onGameOver = configOrUrl.onGameOver;
    } else {
      const isProduction = process.env.NODE_ENV === 'production';
      const needsSsl =
        configOrUrl.ssl !== undefined
          ? configOrUrl.ssl
          : isProduction || (configOrUrl.connectionString && (configOrUrl.connectionString.includes('sslmode=require') || configOrUrl.connectionString.includes('render.com')));

      this.pool = new Pool({
        connectionString: configOrUrl.connectionString,
        max: configOrUrl.max || 5,
        ssl: needsSsl ? (typeof needsSsl === 'object' ? needsSsl : { rejectUnauthorized: false }) : undefined
      });
      this.onGameOver = configOrUrl.onGameOver;
    }
  }

  public type(): StorageType {
    return StorageType.ASYNC;
  }

  /**
   * Connect to Postgres and run idempotent schema migrations
   */
  public async connect(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS bgio_matches (
          id VARCHAR(255) PRIMARY KEY,
          game_name VARCHAR(100) NOT NULL,
          unlisted BOOLEAN DEFAULT FALSE,
          state JSONB,
          initial_state JSONB,
          metadata JSONB,
          log JSONB DEFAULT '[]'::jsonb,
          is_gameover BOOLEAN DEFAULT FALSE,
          created_at BIGINT NOT NULL,
          updated_at BIGINT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_matches_game_updated ON bgio_matches (game_name, updated_at);
        CREATE INDEX IF NOT EXISTS idx_matches_gameover ON bgio_matches (is_gameover);

        CREATE TABLE IF NOT EXISTS game_records (
          id VARCHAR(255) PRIMARY KEY,
          match_id VARCHAR(255) NOT NULL REFERENCES bgio_matches(id) ON DELETE CASCADE,
          game_name VARCHAR(100) NOT NULL,
          score INT,
          max_score INT,
          players JSONB,
          game_summary JSONB,
          completed_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_records_game ON game_records (game_name, completed_at);
      `);
    } finally {
      client.release();
    }
  }

  /**
   * Create a new match in the database
   */
  public async createMatch(matchID: string, opts: CreateMatchOpts): Promise<void> {
    const client = await this.pool.connect();
    try {
      const gameName = opts.metadata?.gameName || 'unknown';
      const unlisted = !!opts.metadata?.unlisted;
      const isGameOver = opts.metadata?.gameover !== undefined && opts.metadata?.gameover !== null;
      const now = Date.now();
      const createdAt = opts.metadata?.createdAt || now;
      const updatedAt = opts.metadata?.updatedAt || now;

      await client.query(
        `
        INSERT INTO bgio_matches (
          id, game_name, unlisted, state, initial_state, metadata, log, is_gameover, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          game_name = EXCLUDED.game_name,
          unlisted = EXCLUDED.unlisted,
          state = EXCLUDED.state,
          initial_state = EXCLUDED.initial_state,
          metadata = EXCLUDED.metadata,
          is_gameover = EXCLUDED.is_gameover,
          updated_at = EXCLUDED.updated_at
        `,
        [
          matchID,
          gameName,
          unlisted,
          JSON.stringify(opts.initialState),
          JSON.stringify(opts.initialState),
          JSON.stringify(opts.metadata),
          JSON.stringify([]),
          isGameOver,
          createdAt,
          updatedAt
        ]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Update match game state and append delta logs
   */
  public async setState(matchID: string, state: State, deltalog?: LogEntry[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      const updatedAt = Date.now();
      const deltaLogJson = deltalog && deltalog.length > 0 ? JSON.stringify(deltalog) : null;

      await client.query(
        `
        UPDATE bgio_matches
        SET
          state = $2,
          log = CASE
            WHEN $3::jsonb IS NOT NULL AND jsonb_array_length($3::jsonb) > 0
              THEN COALESCE(log, '[]'::jsonb) || $3::jsonb
            ELSE COALESCE(log, '[]'::jsonb)
          END,
          updated_at = $4
        WHERE id = $1
        `,
        [matchID, JSON.stringify(state), deltaLogJson, updatedAt]
      );

      const isGameOver = (state?.ctx as any)?.gameover !== undefined || (state?.G as any)?.phase === 'game_over';
      if (isGameOver && this.onGameOver) {
        this.fetch(matchID, { metadata: true })
          .then((res) => {
            this.onGameOver?.(
              matchID,
              res.metadata?.gameName || (state?.G as any)?.name || 'unknown',
              state,
              res.metadata
            );
          })
          .catch((e) => console.warn('[PostgresStore] onGameOver callback error:', e));
      }
    } finally {
      client.release();
    }
  }

  /**
   * Update match metadata
   */
  public async setMetadata(matchID: string, metadata: Server.MatchData): Promise<void> {
    const client = await this.pool.connect();
    try {
      const isGameOver = metadata?.gameover !== undefined && metadata?.gameover !== null;
      const unlisted = !!metadata?.unlisted;
      const updatedAt = metadata?.updatedAt || Date.now();

      await client.query(
        `
        UPDATE bgio_matches
        SET
          metadata = $2,
          is_gameover = $3,
          unlisted = $4,
          updated_at = $5
        WHERE id = $1
        `,
        [matchID, JSON.stringify(metadata), isGameOver, unlisted, updatedAt]
      );

      if (isGameOver && this.onGameOver) {
        this.fetch(matchID, { state: true })
          .then((res) => {
            if (res.state) {
              this.onGameOver?.(matchID, metadata.gameName || 'unknown', res.state, metadata);
            }
          })
          .catch((e) => console.warn('[PostgresStore] onGameOver callback error:', e));
      }
    } finally {
      client.release();
    }
  }

  /**
   * Fetch requested match state, initial state, metadata, and log.
   * Selectively projects only requested columns to minimize database I/O and serialization overhead.
   */
  public async fetch<O extends FetchOpts>(matchID: string, opts: O): Promise<FetchResult> {
    const cols: string[] = [];
    if (opts.state) cols.push('state');
    if (opts.initialState) cols.push('initial_state');
    if (opts.metadata) cols.push('metadata');
    if (opts.log) cols.push('log');

    if (cols.length === 0) {
      return {};
    }

    const client = await this.pool.connect();
    try {
      const res = await client.query(
        `SELECT ${cols.join(', ')} FROM bgio_matches WHERE id = $1`,
        [matchID]
      );

      const result: FetchResult = {};
      if (res.rows.length > 0) {
        const row = res.rows[0];
        if (opts.state) {
          result.state = row.state;
        }
        if (opts.metadata) {
          result.metadata = row.metadata;
        }
        if (opts.log) {
          result.log = row.log || [];
        }
        if (opts.initialState) {
          result.initialState = row.initial_state;
        }
      }
      return result;
    } finally {
      client.release();
    }
  }

  /**
   * Wipe match from database
   */
  public async wipe(matchID: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`DELETE FROM bgio_matches WHERE id = $1`, [matchID]);
    } finally {
      client.release();
    }
  }

  /**
   * List match IDs matching query criteria
   */
  public async listMatches(opts?: ListMatchesOpts): Promise<string[]> {
    const client = await this.pool.connect();
    try {
      const conditions: string[] = [];
      const values: any[] = [];

      if (opts?.gameName) {
        values.push(opts.gameName);
        conditions.push(`game_name = $${values.length}`);
      }

      if (opts?.where?.isGameover !== undefined) {
        values.push(opts.where.isGameover);
        conditions.push(`is_gameover = $${values.length}`);
      }

      if (opts?.where?.updatedBefore !== undefined) {
        values.push(opts.where.updatedBefore);
        conditions.push(`updated_at < $${values.length}`);
      }

      if (opts?.where?.updatedAfter !== undefined) {
        values.push(opts.where.updatedAfter);
        conditions.push(`updated_at > $${values.length}`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const query = `SELECT id FROM bgio_matches ${whereClause} ORDER BY updated_at DESC`;

      const res = await client.query(query, values);
      return res.rows.map((row) => row.id);
    } finally {
      client.release();
    }
  }

  /**
   * Cleans up stale matches that exceeded inactivity TTL or completed gameover TTL
   */
  public async cleanupStaleMatches(
    inactivityTtlMs: number = 24 * 60 * 60 * 1000,
    gameOverTtlMs: number = 2 * 60 * 60 * 1000
  ): Promise<{ deletedCount: number; deletedIds: string[] }> {
    const now = Date.now();
    const inactivityCutoff = now - inactivityTtlMs;
    const gameOverCutoff = now - gameOverTtlMs;

    const client = await this.pool.connect();
    try {
      const res = await client.query(
        `
        DELETE FROM bgio_matches
        WHERE (is_gameover = false AND updated_at < $1)
           OR (is_gameover = true AND updated_at < $2)
        RETURNING id
        `,
        [inactivityCutoff, gameOverCutoff]
      );
      return {
        deletedCount: res.rowCount || 0,
        deletedIds: res.rows.map((r) => r.id)
      };
    } finally {
      client.release();
    }
  }

  /**
   * List detailed information for all rooms in the database for admin management
   */
  public async listAllRoomsDetails(): Promise<
    Array<{
      id: string;
      gameName: string;
      unlisted: boolean;
      isGameover: boolean;
      createdAt: number;
      updatedAt: number;
      players: Array<{ id: string; name?: string; isConnected?: boolean }>;
    }>
  > {
    const client = await this.pool.connect();
    try {
      const res = await client.query(
        `
        SELECT id, game_name as "gameName", unlisted, is_gameover as "isGameover", created_at as "createdAt", updated_at as "updatedAt", metadata
        FROM bgio_matches
        ORDER BY updated_at DESC
        `
      );

      return res.rows.map((row) => {
        const playersMap = row.metadata?.players || {};
        const players = Object.entries<any>(playersMap).map(([id, p]) => ({
          id,
          name: p.name,
          isConnected: p.isConnected
        }));

        return {
          id: row.id,
          gameName: row.gameName,
          unlisted: row.unlisted,
          isGameover: row.isGameover,
          createdAt: Number(row.createdAt),
          updatedAt: Number(row.updatedAt),
          players
        };
      });
    } finally {
      client.release();
    }
  }

  /**
   * Ping database to verify connection health
   */
  public async ping(): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1');
      return true;
    } catch {
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Gracefully drain the connection pool
   */
  public async close(): Promise<void> {
    await this.pool.end();
  }
}

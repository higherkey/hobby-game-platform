import type pg from 'pg';

export interface GameRecord {
  id: string;
  matchId: string;
  gameName: string;
  score?: number;
  maxScore?: number;
  players: Array<{ id: string; name: string }>;
  gameSummary: Record<string, any>;
  completedAt: string;
}

export interface GameHistoryQueryOpts {
  gameName?: string;
  limit?: number;
  offset?: number;
}

export interface GameHistoryResult {
  records: GameRecord[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

/**
 * Extracts game results and writes them to the game_records table.
 * Strictly separates game-specific score parsing from generic storage adapters.
 */
export async function recordCompletedGame(
  pool: pg.Pool,
  matchID: string,
  gameName: string,
  state: any,
  metadata?: any
): Promise<void> {
  const client = await pool.connect();
  try {
    const recordId = `rec_${matchID}`;
    const G = state?.G || {};
    const ctx = state?.ctx || {};

    let score: number | null = null;
    let maxScore: number | null = null;
    const players: Array<{ id: string; name: string }> = [];
    const gameSummary: Record<string, any> = {};

    if (metadata?.players) {
      for (const [id, player] of Object.entries<any>(metadata.players)) {
        players.push({
          id,
          name: player.name || `Player ${id}`
        });
      }
    }

    if (gameName === 'so-clover') {
      score = typeof G.totalScore === 'number' ? G.totalScore : null;
      maxScore = typeof G.maxPossibleScore === 'number' ? G.maxPossibleScore : null;

      if (G.players) {
        const boardSummaries: Record<string, any> = {};
        for (const [pid, board] of Object.entries<any>(G.players)) {
          boardSummaries[pid] = {
            playerName: board.playerName,
            score: board.score,
            attemptNumber: board.attemptNumber,
            isResolved: board.isResolved,
            clues: board.clues
          };
        }
        gameSummary.boards = boardSummaries;
      }
    } else {
      score = typeof G.count === 'number' ? G.count : null;
    }

    gameSummary.turn = ctx.turn;
    gameSummary.phase = G.phase || ctx.phase;

    await client.query(
      `
      INSERT INTO game_records (
        id, match_id, game_name, score, max_score, players, game_summary, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (id) DO UPDATE SET
        score = EXCLUDED.score,
        max_score = EXCLUDED.max_score,
        players = EXCLUDED.players,
        game_summary = EXCLUDED.game_summary,
        completed_at = EXCLUDED.completed_at
      `,
      [
        recordId,
        matchID,
        gameName,
        score,
        maxScore,
        JSON.stringify(players),
        JSON.stringify(gameSummary)
      ]
    );
  } catch (err) {
    console.error(`[GameRecordsHook] Failed to record completed game ${matchID}:`, err);
  } finally {
    client.release();
  }
}

/**
 * Query historical game records with pagination and boundary validation
 */
export async function getGameHistory(
  pool: pg.Pool,
  opts: GameHistoryQueryOpts = {}
): Promise<GameHistoryResult> {
  const client = await pool.connect();
  try {
    const limit = Math.min(Math.max(1, Number(opts.limit) || 20), 100);
    const offset = Math.max(0, Number(opts.offset) || 0);

    const conditions: string[] = [];
    const values: any[] = [];

    if (opts.gameName && typeof opts.gameName === 'string') {
      const sanitizedGameName = opts.gameName.trim().slice(0, 100);
      if (sanitizedGameName.length > 0) {
        values.push(sanitizedGameName);
        conditions.push(`game_name = $${values.length}`);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await client.query(
      `SELECT COUNT(*)::int as total FROM game_records ${whereClause}`,
      values
    );
    const total = countRes.rows[0]?.total || 0;

    const queryValues = [...values, limit, offset];
    const query = `
      SELECT
        id,
        match_id as "matchId",
        game_name as "gameName",
        score,
        max_score as "maxScore",
        players,
        game_summary as "gameSummary",
        completed_at as "completedAt"
      FROM game_records
      ${whereClause}
      ORDER BY completed_at DESC
      LIMIT $${queryValues.length - 1} OFFSET $${queryValues.length}
    `;

    const res = await client.query(query, queryValues);
    return {
      records: res.rows,
      pagination: {
        limit,
        offset,
        total
      }
    };
  } finally {
    client.release();
  }
}

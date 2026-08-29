import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordCompletedGame, getGameHistory } from './gameRecordsHook';

describe('gameRecordsHook', () => {
  let mockClient: any;
  let mockPool: any;

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
      release: vi.fn()
    };

    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient)
    };
  });

  it('records a completed So Clover game with scores and board summaries', async () => {
    mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

    const state = {
      G: {
        totalScore: 14,
        maxPossibleScore: 18,
        players: {
          '0': {
            playerName: 'Alice',
            score: 6,
            attemptNumber: 1,
            isResolved: true,
            clues: { north: 'sun', east: 'hot', south: 'warm', west: 'light' }
          }
        }
      },
      ctx: { turn: 4, phase: 'game_over' }
    };

    const metadata = {
      players: {
        '0': { name: 'Alice' },
        '1': { name: 'Bob' }
      }
    };

    await recordCompletedGame(mockPool, 'match_abc', 'so-clover', state, metadata);

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO game_records'),
      [
        'rec_match_abc',
        'match_abc',
        'so-clover',
        14,
        18,
        JSON.stringify([
          { id: '0', name: 'Alice' },
          { id: '1', name: 'Bob' }
        ]),
        expect.stringContaining('"boards"')
      ]
    );
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('queries game history with pagination and total count', async () => {
    const mockRows = [
      {
        id: 'rec_1',
        matchId: 'match_1',
        gameName: 'so-clover',
        score: 18,
        maxScore: 18,
        players: [{ id: '0', name: 'Alice' }],
        gameSummary: {},
        completedAt: new Date().toISOString()
      }
    ];

    // Mock count query then rows query
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: mockRows });

    const result = await getGameHistory(mockPool, { gameName: 'so-clover', limit: 10, offset: 0 });

    expect(result.records).toEqual(mockRows);
    expect(result.pagination).toEqual({
      limit: 10,
      offset: 0,
      total: 1
    });

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT COUNT(*)::int as total FROM game_records WHERE game_name = $1'),
      ['so-clover']
    );
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT\n        id,\n        match_id as "matchId"'),
      ['so-clover', 10, 0]
    );
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('enforces limit boundary constraints (max 100, min 1)', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await getGameHistory(mockPool, { limit: 500, offset: -5 });

    expect(result.pagination.limit).toBe(100);
    expect(result.pagination.offset).toBe(0);
    expect(mockClient.release).toHaveBeenCalled();
  });
});

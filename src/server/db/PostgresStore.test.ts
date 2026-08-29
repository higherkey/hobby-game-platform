import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostgresStore, StorageType } from './PostgresStore';

describe('PostgresStore', () => {
  let mockClient: any;
  let mockPool: any;

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
      release: vi.fn()
    };

    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      end: vi.fn().mockResolvedValue(undefined)
    };
  });

  it('reports type as ASYNC (1)', () => {
    const store = new PostgresStore({ pool: mockPool });
    expect(store.type()).toBe(StorageType.ASYNC);
  });

  it('runs table and index creation migrations on connect()', async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [] });

    const store = new PostgresStore({ pool: mockPool });
    await store.connect();

    expect(mockPool.connect).toHaveBeenCalled();
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS bgio_matches')
    );
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS game_records')
    );
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('releases client even if migration query throws', async () => {
    mockClient.query.mockRejectedValueOnce(new Error('Connection failed'));

    const store = new PostgresStore({ pool: mockPool });
    await expect(store.connect()).rejects.toThrow('Connection failed');

    expect(mockClient.release).toHaveBeenCalled();
  });

  it('creates match with serialized state and metadata in createMatch()', async () => {
    mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

    const store = new PostgresStore({ pool: mockPool });
    const initialState = { G: { count: 0 }, ctx: { turn: 0 } } as any;
    const metadata = {
      gameName: 'so-clover',
      unlisted: false,
      players: { '0': { name: 'Alice' } }
    } as any;

    await store.createMatch('match_123', { initialState, metadata });

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO bgio_matches'),
      [
        'match_123',
        'so-clover',
        false,
        JSON.stringify(initialState),
        JSON.stringify(initialState),
        JSON.stringify(metadata),
        JSON.stringify([]),
        false,
        expect.any(Number),
        expect.any(Number)
      ]
    );
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('updates state and delta log in setState()', async () => {
    mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

    const store = new PostgresStore({ pool: mockPool });
    const newState = { G: { count: 1 }, ctx: { turn: 1 } } as any;
    const deltaLog = [{ action: { type: 'INCREMENT' } }] as any;

    await store.setState('match_123', newState, deltaLog);

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE bgio_matches'),
      ['match_123', JSON.stringify(newState), JSON.stringify(deltaLog), expect.any(Number)]
    );
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('updates metadata and marks is_gameover in setMetadata()', async () => {
    mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

    const store = new PostgresStore({ pool: mockPool });
    const metadata = {
      gameName: 'so-clover',
      gameover: { winner: '0' },
      unlisted: true,
      updatedAt: 123456789
    } as any;

    await store.setMetadata('match_123', metadata);

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE bgio_matches'),
      ['match_123', JSON.stringify(metadata), true, true, 123456789]
    );
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('fetches only requested fields in fetch()', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [
        {
          state: { G: { count: 5 } },
          initial_state: { G: { count: 0 } },
          metadata: { gameName: 'counter' },
          log: [{ action: { type: 'INCREMENT' } }]
        }
      ]
    });

    const store = new PostgresStore({ pool: mockPool });
    const result = await store.fetch('match_123', { state: true, metadata: true });

    expect(result.state).toEqual({ G: { count: 5 } });
    expect(result.metadata).toEqual({ gameName: 'counter' });
    expect(result.log).toBeUndefined();
    expect(result.initialState).toBeUndefined();
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('returns empty object when match is not found in fetch()', async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [] });

    const store = new PostgresStore({ pool: mockPool });
    const result = await store.fetch('unknown_match', { state: true });

    expect(result).toEqual({});
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('deletes match in wipe()', async () => {
    mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

    const store = new PostgresStore({ pool: mockPool });
    await store.wipe('match_123');

    expect(mockClient.query).toHaveBeenCalledWith(
      'DELETE FROM bgio_matches WHERE id = $1',
      ['match_123']
    );
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('filters matches by gameName and where conditions in listMatches()', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [{ id: 'match_1' }, { id: 'match_2' }]
    });

    const store = new PostgresStore({ pool: mockPool });
    const matches = await store.listMatches({
      gameName: 'so-clover',
      where: {
        isGameover: false,
        updatedBefore: 2000,
        updatedAfter: 1000
      }
    });

    expect(matches).toEqual(['match_1', 'match_2']);
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE game_name = $1 AND is_gameover = $2 AND updated_at < $3 AND updated_at > $4'),
      ['so-clover', false, 2000, 1000]
    );
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('verifies connection health via ping()', async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

    const store = new PostgresStore({ pool: mockPool });
    const isHealthy = await store.ping();

    expect(isHealthy).toBe(true);
    expect(mockClient.query).toHaveBeenCalledWith('SELECT 1');
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('returns false on ping() failure', async () => {
    mockClient.query.mockRejectedValueOnce(new Error('Connection timeout'));

    const store = new PostgresStore({ pool: mockPool });
    const isHealthy = await store.ping();

    expect(isHealthy).toBe(false);
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('cleans up stale matches exceeding inactivity and gameover TTL', async () => {
    mockClient.query.mockResolvedValueOnce({
      rowCount: 3,
      rows: [{ id: 'match_1' }, { id: 'match_2' }, { id: 'match_3' }]
    });

    const store = new PostgresStore({ pool: mockPool });
    const result = await store.cleanupStaleMatches(86400000, 7200000);

    expect(result.deletedCount).toBe(3);
    expect(result.deletedIds).toEqual(['match_1', 'match_2', 'match_3']);
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM bgio_matches'),
      [expect.any(Number), expect.any(Number)]
    );
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('lists detailed information for all rooms in listAllRoomsDetails()', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'match_1',
          gameName: 'so-clover',
          unlisted: false,
          isGameover: false,
          createdAt: 1000,
          updatedAt: 2000,
          metadata: {
            players: {
              '0': { name: 'Alice', isConnected: true },
              '1': { name: 'Bob', isConnected: false }
            }
          }
        }
      ]
    });

    const store = new PostgresStore({ pool: mockPool });
    const rooms = await store.listAllRoomsDetails();

    expect(rooms).toHaveLength(1);
    expect(rooms[0].id).toBe('match_1');
    expect(rooms[0].gameName).toBe('so-clover');
    expect(rooms[0].players).toHaveLength(2);
    expect(rooms[0].players[0]).toEqual({ id: '0', name: 'Alice', isConnected: true });
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('drains pool on close()', async () => {
    const store = new PostgresStore({ pool: mockPool });
    await store.close();
    expect(mockPool.end).toHaveBeenCalled();
  });
});

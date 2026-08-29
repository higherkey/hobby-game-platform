import { describe, it, expect, beforeEach } from 'vitest';
import { BaseRoom } from './Room';
import { BaseGame } from './Game';
import type { Ctx } from 'boardgame.io';

interface SimpleState {
  score: number;
}

class SimpleGame extends BaseGame<SimpleState> {
  public readonly name = 'simple-game';
  public setup(_ctx: Ctx): SimpleState {
    return { score: 0 };
  }
  public moves = {
    addPoints: ({ G }: { G: SimpleState }, pts: number) => {
      G.score += pts;
    }
  };
}

describe('BaseRoom Integration & Lifecycle', () => {
  let game: SimpleGame;
  let room: BaseRoom<SimpleState>;

  beforeEach(() => {
    game = new SimpleGame();
    room = new BaseRoom<SimpleState>({
      gameName: game.name,
      game: game,
      serverUrl: 'http://localhost:8000'
    });
  });

  it('initializes room config with game configuration', () => {
    expect(room.gameName).toBe('simple-game');
  });

  it('creates local game client and processes moves cleanly', () => {
    const client = room.createGameClient({
      matchID: 'test-local-match',
      playerID: '0',
      multiplayerType: 'local'
    });

    client.start();

    const initialState = client.getState();
    expect(initialState?.G.score).toBe(0);

    // Dispatch move
    client.moves.addPoints(10);

    const updatedState = client.getState();
    expect(updatedState?.G.score).toBe(10);

    client.stop();
  });

  it('persists and retrieves joined room sessions', () => {
    const session = {
      matchID: 'match-123',
      playerID: '0',
      playerCredentials: 'token-xyz',
      playerName: 'Player One'
    };

    // Save
    room.saveSession(session);

    // Retrieve
    const retrieved = room.getSavedSession('match-123');
    expect(retrieved).toEqual(session);

    // Clear
    room.clearSession('match-123');
    const cleared = room.getSavedSession('match-123');
    expect(cleared).toBeNull();
  });
});

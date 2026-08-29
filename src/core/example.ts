import { BaseGame } from './Game';
import { BaseRoom } from './Room';
import type { Ctx } from 'boardgame.io';

// 1. Define game state interface (G)
export interface CounterGameState {
  count: number;
  history: Array<{ player: string; amount: number; timestamp: number }>;
}

// 2. Define Game by extending BaseGame
export class CounterGame extends BaseGame<CounterGameState> {
  public readonly name = 'counter-example';
  public minPlayers = 1;
  public maxPlayers = 4;

  // Setup returns pure JSON-serializable G state
  public setup(_ctx: Ctx): CounterGameState {
    return {
      count: 0,
      history: []
    };
  }

  // Define pure moves with zero side effects
  public moves = {
    increment: ({ G, ctx }: { G: CounterGameState; ctx: Ctx }, amount: number = 1) => {
      G.count += amount;
      G.history.push({
        player: ctx.currentPlayer,
        amount,
        timestamp: Date.now()
      });
    },
    reset: ({ G, ctx }: { G: CounterGameState; ctx: Ctx }) => {
      G.count = 0;
      G.history.push({
        player: ctx.currentPlayer,
        amount: 0,
        timestamp: Date.now()
      });
    }
  };

  // Optional phases or stages
  public phases = {
    active: {
      start: true,
      moves: this.moves
    }
  };
}

// 3. Example function demonstrating how to initialize a Room and start a basic game instance
export async function runExample() {
  const game = new CounterGame();

  // Create room manager
  const room = new BaseRoom<CounterGameState>({
    gameName: game.name,
    game: game,
    serverUrl: 'http://localhost:8000'
  });

  console.log(`[Example] Room created for game: ${room.gameName}`);

  // Create a local client for player "0"
  const client = room.createGameClient({
    matchID: 'demo-room-1',
    playerID: '0',
    multiplayerType: 'local'
  });

  // Start client
  client.start();

  // Subscribe to state updates
  client.subscribe((state: any) => {
    if (state) {
      console.log('[Example] Current Count:', state.G.count, 'Turn:', state.ctx.turn);
    }
  });

  // Make a move
  console.log('[Example] Dispatching increment move (+5)...');
  client.moves.increment(5);

  // Stop client
  client.stop();
}

if (typeof require !== 'undefined' && require.main === module) {
  runExample().catch(console.error);
}

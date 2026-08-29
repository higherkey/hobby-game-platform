import { Server, Origins } from 'boardgame.io/server';
import type { Game } from 'boardgame.io';
import type { BaseGame } from './Game';

export interface ServerConfig {
  port?: number;
  origins?: (string | RegExp | boolean)[];
}

export class BaseServer {
  public static createServer(
    games: (Game | BaseGame<any, any>)[],
    options: ServerConfig = {}
  ) {
    const { port = 8000, origins = [Origins.LOCALHOST, Origins.LOCALHOST_IN_DEVELOPMENT, '*'] } = options;

    const normalizedGames = games.map((g) =>
      'toBoardgameConfig' in g && typeof g.toBoardgameConfig === 'function'
        ? g.toBoardgameConfig()
        : (g as Game<any, any>)
    );

    const server = Server({
      games: normalizedGames as any,
      origins
    });

    if (server.router) {
      server.router.get('/health', (ctx) => {
        ctx.status = 200;
        ctx.body = { status: 'ok', timestamp: Date.now() };
      });
    } else {
      console.warn('[BoardGame Server] server.router not found; /health route was not registered.');
    }

    return {
      server,
      run: () => {
        console.log(`[BoardGame Server] Starting on port ${port}...`);
        server.run(port);
      }
    };
  }
}

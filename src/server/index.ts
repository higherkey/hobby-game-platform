import { Origins } from 'boardgame.io/server';
import { BaseServer } from '../core/Server';
import { SoCloverGame } from '../games/so-clover/game';
import { CounterGame } from '../core/example';

const PORT = Number(process.env.PORT) || 8000;

const cloverGame = new SoCloverGame();
const counterGame = new CounterGame();

const allowedOrigins: (string | RegExp | boolean)[] = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
  : [Origins.LOCALHOST, Origins.LOCALHOST_IN_DEVELOPMENT, /\.vercel\.app$/];

if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('*');
}

// Create and start boardgame.io multiplayer server for all platform games
const { run } = BaseServer.createServer([cloverGame, counterGame], {
  port: PORT,
  origins: allowedOrigins
});

run();

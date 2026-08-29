import { BaseServer } from '../core/Server';
import { SoCloverGame } from '../games/so-clover/game';
import { CounterGame } from '../core/example';

const PORT = Number(process.env.PORT) || 8000;

const cloverGame = new SoCloverGame();
const counterGame = new CounterGame();

// Create and start boardgame.io multiplayer server for all platform games
const { run } = BaseServer.createServer([cloverGame, counterGame], {
  port: PORT,
  origins: ['*']
});

run();

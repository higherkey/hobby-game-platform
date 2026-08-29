// Platform Core APIs
export { BaseGame, assertJsonSerializable } from './core/Game';
export type { MoveFunction, GameStateValidator } from './core/Game';

export { BaseRoom } from './core/Room';
export type {
  RoomConfig,
  PlayerSeat,
  MatchInfo,
  JoinedRoomSession,
  GameClientType
} from './core/Room';

export { BaseServer } from './core/Server';
export type { ServerConfig } from './core/Server';

// Games
export { SoCloverGame, getEdgeWord, getBoardKeywordPairs, getRecordOfLegendsRating } from './games/so-clover/game';
export type {
  SoCloverGameState,
  PlayerBoard,
  KeywordCard,
  PlacedCard,
  Direction
} from './games/so-clover/types';
export { KEYWORD_DECK } from './games/so-clover/words';

import { LobbyClient } from 'boardgame.io/client';
import { Client } from 'boardgame.io/client';
import { SocketIO, Local } from 'boardgame.io/multiplayer';
import type { Game } from 'boardgame.io';
import type { BaseGame } from './Game';
import { createLogger } from './Logger';

export type GameClientType<G extends any = any> = ReturnType<typeof Client<G>>;

export interface RoomConfig {
  serverUrl?: string;
  gameName: string;
  game: Game | BaseGame<any, any>;
  numPlayers?: number;
}

export interface PlayerSeat {
  id: string; // "0", "1", ...
  name?: string;
  isConnected?: boolean;
}

export interface MatchInfo {
  matchID: string;
  gameName: string;
  players: PlayerSeat[];
  setupData?: any;
  createdAt: number;
  updatedAt: number;
  gameover?: any;
}

export interface JoinedRoomSession {
  matchID: string;
  playerID: string;
  playerCredentials?: string;
  playerName: string;
}

function getDefaultServerUrl(): string {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SERVER_URL) {
    return (import.meta as any).env.VITE_SERVER_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    // In local dev (e.g. localhost or 127.0.0.1 on Vite dev server 5173), server runs on port 8000
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return `${window.location.protocol}//${window.location.hostname}:8000`;
    }
    // In production / deployed web, server is at the same origin (no explicit :8000 port)
    return window.location.origin;
  }
  return 'http://localhost:8000';
}

/**
 * BaseRoom manages matchmaking, room lifecycle, credentials, and client-server synchronization.
 */
export class BaseRoom<G extends any = any> {
  private lobbyClient?: LobbyClient;
  private serverUrl: string;
  private game: Game<any, any>;
  public readonly gameName: string;
  private storageKeyPrefix = 'bgio_room_session_';
  private memorySessions: Map<string, JoinedRoomSession> = new Map();
  private logger = createLogger('BaseRoom');

  constructor(config: RoomConfig) {
    this.serverUrl = (config.serverUrl || getDefaultServerUrl()).replace(/\/+$/, '');
    this.gameName = config.gameName;

    if ('toBoardgameConfig' in config.game && typeof config.game.toBoardgameConfig === 'function') {
      this.game = config.game.toBoardgameConfig();
    } else {
      this.game = config.game as Game<any, any>;
    }

    if (typeof window !== 'undefined') {
      this.lobbyClient = new LobbyClient({ server: this.serverUrl });
    }
  }

  /**
   * Set custom server URL for Lobby Client
   */
  public setServerUrl(url: string): void {
    this.serverUrl = url.replace(/\/+$/, '');
    if (typeof window !== 'undefined') {
      this.lobbyClient = new LobbyClient({ server: this.serverUrl });
    }
  }

  /**
   * List available matches from lobby for specific game or platform games
   */
  public async listRooms(targetGameName?: string): Promise<MatchInfo[]> {
    if (!this.lobbyClient) return [];
    try {
      const gamesToList = targetGameName
        ? [targetGameName]
        : [this.gameName, 'counter-example'];

      const allMatches: MatchInfo[] = [];
      for (const g of gamesToList) {
        try {
          const response = await this.lobbyClient.listMatches(g);
          const matches: MatchInfo[] = response.matches.map((m: any) => ({
            matchID: m.matchID,
            gameName: m.gameName,
            players: m.players.map((p: any) => ({
              id: String(p.id),
              name: p.name,
              isConnected: p.isConnected
            })),
            setupData: m.setupData,
            createdAt: m.createdAt,
            updatedAt: m.updatedAt,
            gameover: m.gameover
          }));
          allMatches.push(...matches);
        } catch {
          // ignore single game list errors
        }
      }
      return allMatches;
    } catch (err) {
      this.logger.warn('Could not fetch rooms from lobby server', { error: String(err) });
      return [];
    }
  }

  /**
   * Create a new multiplayer room via Lobby API
   */
  public async createRoom(numPlayers: number, setupData?: any, targetGameName?: string): Promise<string> {
    if (!this.lobbyClient) {
      throw new Error('Lobby client is not initialized in non-browser environment.');
    }
    const gName = targetGameName || this.gameName;
    this.logger.info(`Creating room for ${numPlayers} players (${gName}) on ${this.serverUrl}...`);
    const result = await this.lobbyClient.createMatch(gName, {
      numPlayers,
      setupData
    });
    this.logger.info(`Room created successfully`, { matchID: result.matchID, numPlayers, gameName: gName });
    return result.matchID;
  }

  /**
   * Join an existing room, obtaining player credentials and persisting session.
   * Gracefully reuses credentials if already joined to prevent 409 Conflict.
   */
  public async joinRoom(
    matchID: string,
    playerID: string,
    playerName: string,
    targetGameName?: string
  ): Promise<JoinedRoomSession> {
    if (!this.lobbyClient) {
      throw new Error('Lobby client is not initialized in non-browser environment.');
    }

    const gName = targetGameName || this.gameName;
    const saved = this.getSavedSession(matchID);
    if (saved && saved.playerCredentials && (saved.playerID === playerID || playerID === undefined || playerID === null)) {
      this.logger.info(`Reusing saved credentials for room ${matchID}`, { playerID: saved.playerID, playerName });
      return saved;
    }

    try {
      this.logger.info(`Sending join request for room ${matchID} (${gName})`, { playerID, playerName });
      const { playerCredentials } = await this.lobbyClient.joinMatch(gName, matchID, {
        playerID,
        playerName
      });

      const session: JoinedRoomSession = {
        matchID,
        playerID,
        playerCredentials,
        playerName
      };

      this.saveSession(session);
      this.logger.info(`Joined room successfully`, { matchID, playerID });
      return session;
    } catch (err: any) {
      if (saved && saved.playerCredentials) {
        this.logger.warn(`Join error; falling back to saved session credentials`, { matchID, error: String(err) });
        return saved;
      }
      this.logger.error(`Failed to join room ${matchID}`, { error: String(err), playerID });
      throw err;
    }
  }

  /**
   * Leave a match and clear session.
   */
  public async leaveRoom(matchID: string, playerID: string, credentials?: string, targetGameName?: string): Promise<void> {
    this.logger.info(`Leaving room ${matchID}`, { playerID });
    if (this.lobbyClient && credentials) {
      try {
        await this.lobbyClient.leaveMatch(targetGameName || this.gameName, matchID, {
          playerID,
          credentials
        });
      } catch (e) {
        this.logger.warn('Error sending leaveMatch request to server', { error: String(e) });
      }
    }
    this.clearSession(matchID);
  }

  /**
   * Creates a boardgame.io Client instance hooked up to either remote server or local master.
   */
  public createGameClient(options: {
    matchID?: string;
    playerID?: string | null;
    credentials?: string;
    multiplayerType?: 'socket' | 'local';
    debug?: boolean;
    game?: Game | BaseGame<any, any>;
  }): GameClientType<G> {
    const { matchID, playerID, credentials, multiplayerType = 'socket', debug = false, game: customGame } = options;

    const gameToUse = customGame
      ? ('toBoardgameConfig' in customGame && typeof customGame.toBoardgameConfig === 'function'
          ? customGame.toBoardgameConfig()
          : (customGame as Game<any, any>))
      : this.game;

    this.logger.info(`Creating game client for match ${matchID || 'default'}`, {
      playerID,
      multiplayerType,
      serverUrl: this.serverUrl
    });

    const multiplayer =
      multiplayerType === 'socket' && this.serverUrl
        ? SocketIO({ server: this.serverUrl })
        : Local();

    const client = Client({
      game: gameToUse,
      matchID: matchID || 'default',
      playerID: playerID ?? undefined,
      credentials,
      multiplayer,
      debug
    }) as GameClientType<G>;

    const originalStop = client.stop ? client.stop.bind(client) : undefined;
    if (originalStop) {
      client.stop = () => {
        try {
          originalStop();
        } catch (err) {
          this.logger.warn('Handled SocketIO transport close error on stop()', { error: String(err) });
        }
      };
    }

    return client;
  }

  /**
   * Session persistence in localStorage with memory fallback
   */
  public saveSession(session: JoinedRoomSession): void {
    this.memorySessions.set(session.matchID, session);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(
          `${this.storageKeyPrefix}${session.matchID}`,
          JSON.stringify(session)
        );
      } catch (e) {
        console.warn('[BaseRoom] LocalStorage save failed', e);
      }
    }
  }

  public getSavedSession(matchID: string): JoinedRoomSession | null {
    if (typeof localStorage !== 'undefined') {
      try {
        const item = localStorage.getItem(`${this.storageKeyPrefix}${matchID}`);
        if (item) return JSON.parse(item);
      } catch {
        // fallback to memory
      }
    }
    return this.memorySessions.get(matchID) || null;
  }

  public clearSession(matchID: string): void {
    this.memorySessions.delete(matchID);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(`${this.storageKeyPrefix}${matchID}`);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Verifies if a saved session corresponds to an active match on the server.
   * If the match is invalid or expired, clears the session and returns null.
   */
  public async verifySession(matchID: string): Promise<JoinedRoomSession | null> {
    const session = this.getSavedSession(matchID);
    if (!session) return null;

    if (this.lobbyClient) {
      try {
        const match = await this.lobbyClient.getMatch(this.gameName, matchID);
        if (!match) {
          this.clearSession(matchID);
          return null;
        }
      } catch (err) {
        console.warn(`[BaseRoom] Match ${matchID} not found or expired:`, err);
        this.clearSession(matchID);
        return null;
      }
    }
    return session;
  }
}

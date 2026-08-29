import { LobbyClient } from 'boardgame.io/client';
import { Client } from 'boardgame.io/client';
import { SocketIO, Local } from 'boardgame.io/multiplayer';
import type { Game } from 'boardgame.io';
import type { BaseGame } from './Game';

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
  let url = 'http://localhost:8000';
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SERVER_URL) {
    url = (import.meta as any).env.VITE_SERVER_URL;
  } else if (typeof window !== 'undefined') {
    url = `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return url.replace(/\/+$/, '');
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
   * List available matches from lobby
   */
  public async listRooms(): Promise<MatchInfo[]> {
    if (!this.lobbyClient) return [];
    try {
      const response = await this.lobbyClient.listMatches(this.gameName);
      return response.matches.map((m: any) => ({
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
    } catch (err) {
      console.warn('[BaseRoom] Could not fetch rooms from lobby server:', err);
      return [];
    }
  }

  /**
   * Create a new multiplayer room via Lobby API
   */
  public async createRoom(numPlayers: number, setupData?: any): Promise<string> {
    if (!this.lobbyClient) {
      throw new Error('Lobby client is not initialized in non-browser environment.');
    }
    const result = await this.lobbyClient.createMatch(this.gameName, {
      numPlayers,
      setupData
    });
    return result.matchID;
  }

  /**
   * Join an existing room, obtaining player credentials and persisting session.
   */
  public async joinRoom(
    matchID: string,
    playerID: string,
    playerName: string
  ): Promise<JoinedRoomSession> {
    if (!this.lobbyClient) {
      throw new Error('Lobby client is not initialized in non-browser environment.');
    }

    const { playerCredentials } = await this.lobbyClient.joinMatch(this.gameName, matchID, {
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
    return session;
  }

  /**
   * Leave a match and clear session.
   */
  public async leaveRoom(matchID: string, playerID: string, credentials?: string): Promise<void> {
    if (this.lobbyClient && credentials) {
      try {
        await this.lobbyClient.leaveMatch(this.gameName, matchID, {
          playerID,
          credentials
        });
      } catch (e) {
        console.warn('[BaseRoom] Error leaving match:', e);
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
  }): GameClientType<G> {
    const { matchID, playerID, credentials, multiplayerType = 'socket', debug = false } = options;

    const multiplayer =
      multiplayerType === 'socket' && this.serverUrl
        ? SocketIO({ server: this.serverUrl })
        : Local();

    return Client({
      game: this.game,
      matchID: matchID || 'default',
      playerID: playerID ?? undefined,
      credentials,
      multiplayer,
      debug
    }) as GameClientType<G>;
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
}

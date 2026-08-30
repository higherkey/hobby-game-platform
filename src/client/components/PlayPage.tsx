import React, { useState, useEffect, useMemo } from 'react';
import type { BaseRoom, MatchInfo } from '../../core/Room';
import type { UserSession } from '../auth/authStore';
import {
  Users,
  Play,
  Plus,
  RefreshCw,
  Search,
  Globe,
  Smartphone,
  LogIn,
  Layers,
  Clock,
  X
} from 'lucide-react';
import { ModalDialog } from './common/ModalDialog';
import { GameRoomSettings } from './GameRoomSettings';
import { createLogger } from '../../core/Logger';

const logger = createLogger('PlayPage');

export interface PlayPageProps {
  roomManager: BaseRoom;
  currentUser: UserSession;
  onStartLocalGame: (
    gameName: string,
    numPlayers: number,
    playerName: string,
    options?: { allowSingleCardRotation?: boolean }
  ) => void;
  onJoinOnlineMatch: (matchID: string, playerID: string, playerName: string, gameName?: string) => Promise<void> | void;
  initialGameFilter?: string;
}

export const PlayPage: React.FC<PlayPageProps> = ({
  roomManager,
  currentUser,
  onStartLocalGame,
  onJoinOnlineMatch,
  initialGameFilter = 'all'
}) => {
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGameFilter, setSelectedGameFilter] = useState<string>(initialGameFilter);
  const [openSeatsOnly, setOpenSeatsOnly] = useState(false);

  // Live rooms state
  const [rooms, setRooms] = useState<MatchInfo[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [joiningMatchId, setJoiningMatchId] = useState<string | null>(null);

  // Host modal state
  const [showHostModal, setShowHostModal] = useState(false);
  const [hostGameName, setHostGameName] = useState('so-clover');
  const [hostNumPlayers, setHostNumPlayers] = useState(4);
  const [hostAllowCardRotation, setHostAllowCardRotation] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  // Local Pass & Play modal state
  const [showLocalModal, setShowLocalModal] = useState(false);
  const [localGameName, setLocalGameName] = useState('so-clover');
  const [localNumPlayers, setLocalNumPlayers] = useState(2);
  const [localPlayerName, setLocalPlayerName] = useState(currentUser.username || 'Player 1');
  const [localAllowCardRotation, setLocalAllowCardRotation] = useState(false);

  // Sync user name changes
  useEffect(() => {
    if (currentUser.username) {
      setLocalPlayerName(currentUser.username);
    }
  }, [currentUser.username]);

  // Dynamic poll available rooms every 2.5s
  useEffect(() => {
    let isMounted = true;

    const fetchRooms = () => {
      roomManager
        .listRooms()
        .then((list) => {
          if (isMounted) {
            setRooms(list);
          }
        })
        .catch((e) => {
          logger.warn('Failed to fetch rooms', { error: String(e) });
        });
    };

    setIsLoadingRooms(true);
    roomManager
      .listRooms()
      .then((list) => {
        if (isMounted) {
          setRooms(list);
        }
      })
      .catch((e) => {
        logger.warn('Initial list rooms error', { error: String(e) });
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingRooms(false);
        }
      });

    const timer = setInterval(fetchRooms, 2500);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [roomManager]);

  const handleManualRefresh = async () => {
    setIsLoadingRooms(true);
    try {
      const list = await roomManager.listRooms();
      setRooms(list);
    } catch (e) {
      logger.warn('Manual fetch rooms error', { error: String(e) });
    } finally {
      setIsLoadingRooms(false);
    }
  };

  const handleCreateOnlineRoom = async () => {
    if (isCreatingRoom || joiningMatchId) return;

    const trimmedName = (currentUser.username || 'Player 1').trim().slice(0, 50);
    logger.info(`Creating online room: ${hostGameName}, ${hostNumPlayers} players, host: ${trimmedName}`);

    setIsCreatingRoom(true);
    try {
      const setupData =
        hostGameName === 'so-clover'
          ? { options: { allowSingleCardRotation: hostAllowCardRotation } }
          : undefined;

      const matchID = await roomManager.createRoom(hostNumPlayers, setupData, hostGameName);
      setShowHostModal(false);
      setJoiningMatchId(matchID);
      await onJoinOnlineMatch(matchID, '0', trimmedName, hostGameName);
    } catch (err) {
      logger.error('Failed to create room', { error: String(err) });
      alert(`Could not create room: ${String(err)}`);
      setJoiningMatchId(null);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleJoinSeat = async (matchID: string, seatId: string, nameToUse?: string, gameName?: string) => {
    if (joiningMatchId) return;
    const finalName = (nameToUse || currentUser.username || 'Player').trim().slice(0, 50);

    logger.info(`Joining seat ${seatId} for room ${matchID} as "${finalName}"`);
    setJoiningMatchId(matchID);
    try {
      await onJoinOnlineMatch(matchID, seatId, finalName, gameName);
    } catch (err) {
      logger.error(`Failed to join seat ${seatId} for room ${matchID}`, { error: String(err) });
      alert(`Failed to join room: ${String(err)}`);
      setJoiningMatchId(null);
    }
  };

  const handleLaunchLocal = (e: React.FormEvent) => {
    e.preventDefault();
    setShowLocalModal(false);
    onStartLocalGame(
      localGameName,
      localNumPlayers,
      localPlayerName.trim() || 'Player 1',
      localGameName === 'so-clover' ? { allowSingleCardRotation: localAllowCardRotation } : undefined
    );
  };

  // Pre-compute saved sessions
  const savedSessionsByMatchId = useMemo(() => {
    const map: Record<string, ReturnType<typeof roomManager.getSavedSession>> = {};
    for (const r of rooms) {
      map[r.matchID] = roomManager.getSavedSession(r.matchID);
    }
    return map;
  }, [rooms, roomManager]);

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      // Game filter
      if (selectedGameFilter !== 'all' && r.gameName !== selectedGameFilter) {
        return false;
      }

      // Open seats filter
      const hasOpenSeats = r.players.some((p) => !p.name);
      if (openSeatsOnly && !hasOpenSeats) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesId = r.matchID.toLowerCase().includes(query);
        const matchesGame = r.gameName.toLowerCase().includes(query);
        const matchesPlayer = r.players.some((p) => p.name && p.name.toLowerCase().includes(query));
        if (!matchesId && !matchesGame && !matchesPlayer) {
          return false;
        }
      }

      return true;
    });
  }, [rooms, selectedGameFilter, openSeatsOnly, searchQuery]);

  return (
    <div className="play-page-container">
      {/* Page Header */}
      <div className="play-page-header">
        <div>
          <h1 className="play-page-title">Play & Browse Games</h1>
          <p className="play-page-subtitle">
            Choose a game from the directory or join live multiplayer rooms hosted by other players.
          </p>
        </div>

        <div className="play-header-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setHostGameName('so-clover');
              setShowHostModal(true);
            }}
          >
            <Plus size={16} /> Host Online Match
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setLocalGameName('so-clover');
              setShowLocalModal(true);
            }}
          >
            <Smartphone size={16} /> Pass & Play (Local)
          </button>
        </div>
      </div>

      {/* SECTION 1: Game Directory */}
      <section className="directory-section">
        <div className="section-title-row">
          <h2 className="section-title">
            <Layers size={18} /> Game Directory
          </h2>
          <span className="section-count-tag">2 Games Available</span>
        </div>

        <div className="directory-grid">
          {/* So Clover Card */}
          <div className="directory-card">
            <div className="dir-card-header clover-header-tint">
              <span className="dir-card-icon">🍀</span>
              <div className="dir-card-badges">
                <span className="badge badge-green">Cooperative</span>
                <span className="badge badge-yellow">Word Deduction</span>
              </div>
            </div>

            <div className="dir-card-body">
              <h3 className="dir-card-title">So Clover!</h3>
              <p className="dir-card-desc">
                Link secret keywords on your clover board with single-word clues. Work together as a team
                to guess and resolve everyone&apos;s boards!
              </p>

              <div className="dir-card-meta">
                <span className="meta-item">
                  <Users size={14} /> 1-6 Players
                </span>
                <span className="meta-item">
                  <Clock size={14} /> 15-30 Mins
                </span>
              </div>

              <div className="dir-card-footer">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setHostGameName('so-clover');
                    setShowHostModal(true);
                  }}
                >
                  <Globe size={15} /> Host Room
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setLocalGameName('so-clover');
                    setShowLocalModal(true);
                  }}
                >
                  <Smartphone size={15} /> Pass & Play
                </button>
              </div>
            </div>
          </div>

          {/* Counter Duel Card */}
          <div className="directory-card">
            <div className="dir-card-header counter-header-tint">
              <span className="dir-card-icon">⚡</span>
              <div className="dir-card-badges">
                <span className="badge badge-yellow">Arcade</span>
                <span className="badge badge-green">Real-Time Sync</span>
              </div>
            </div>

            <div className="dir-card-body">
              <h3 className="dir-card-title">Counter Duel</h3>
              <p className="dir-card-desc">
                Fast turn-based numeric strategy showdown and real-time state synchronization test ground.
              </p>

              <div className="dir-card-meta">
                <span className="meta-item">
                  <Users size={14} /> 1-4 Players
                </span>
                <span className="meta-item">
                  <Clock size={14} /> 5 Mins
                </span>
              </div>

              <div className="dir-card-footer">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setHostGameName('counter-example');
                    setShowHostModal(true);
                  }}
                >
                  <Globe size={15} /> Host Room
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setLocalGameName('counter-example');
                    setShowLocalModal(true);
                  }}
                >
                  <Smartphone size={15} /> Solo Play
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: Live Active Games (Filterable) */}
      <section className="live-rooms-section">
        <div className="section-title-row">
          <div>
            <h2 className="section-title">
              <Globe size={18} /> Live Active Matches
            </h2>
            <p className="section-subtitle">
              Join open seats in games hosted on the platform.
            </p>
          </div>

          <div className="live-refresh-control">
            <span className="auto-refresh-tag">Syncs live (2.5s)</span>
            <button
              type="button"
              className="btn-secondary btn-icon-only"
              onClick={handleManualRefresh}
              disabled={isLoadingRooms}
              aria-label="Refresh room list"
              title="Refresh room list"
            >
              <RefreshCw size={14} className={isLoadingRooms ? 'spin-animation' : ''} />
            </button>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="filter-toolbar" role="search" aria-label="Filter active matches">
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" aria-hidden="true" />
            <input
              type="text"
              className="search-input"
              placeholder="Search by Room ID, game name, or player..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search rooms"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="filter-controls-group">
            {/* Game Filter */}
            <div className="filter-select-group">
              <label htmlFor="game-filter-select" className="sr-only">
                Filter by Game
              </label>
              <select
                id="game-filter-select"
                className="filter-select"
                value={selectedGameFilter}
                onChange={(e) => setSelectedGameFilter(e.target.value)}
              >
                <option value="all">All Games</option>
                <option value="so-clover">🍀 So Clover!</option>
                <option value="counter-example">⚡ Counter Duel</option>
              </select>
            </div>

            {/* Open Seats Toggle */}
            <label className="checkbox-filter-label">
              <input
                type="checkbox"
                checked={openSeatsOnly}
                onChange={(e) => setOpenSeatsOnly(e.target.checked)}
                className="checkbox-custom"
              />
              <span>Open Seats Only</span>
            </label>
          </div>
        </div>

        {/* Live Rooms Grid */}
        {filteredRooms.length === 0 ? (
          <div className="empty-rooms-card">
            <div className="empty-rooms-icon-box">
              <Users size={28} />
            </div>
            <h3>No matching rooms found</h3>
            <p className="empty-rooms-desc">
              {searchQuery || selectedGameFilter !== 'all' || openSeatsOnly
                ? 'No matches fit your active search or filters. Try adjusting your filters or host a new room.'
                : 'There are currently no active public rooms. Be the first to host one!'}
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setHostGameName('so-clover');
                setShowHostModal(true);
              }}
            >
              <Plus size={16} /> Host a Match Now
            </button>
          </div>
        ) : (
          <div className="live-rooms-grid">
            {filteredRooms.map((r) => {
              const savedSession = savedSessionsByMatchId[r.matchID];
              const openSeat = r.players.find((p) => !p.name);
              const filledCount = r.players.filter((p) => p.name).length;
              const totalCount = r.players.length;
              const isThisRoomBusy = joiningMatchId === r.matchID;
              const isSoClover = r.gameName === 'so-clover';

              return (
                <div key={r.matchID} className="live-room-card">
                  <div className="live-room-header">
                    <div className="room-title-group">
                      <span className="room-game-pill">
                        {isSoClover ? '🍀 So Clover!' : '⚡ Counter Duel'}
                      </span>
                      <span className="room-match-id">#{r.matchID.slice(0, 6)}</span>
                    </div>

                    <span
                      className={`badge ${
                        filledCount === totalCount
                          ? 'badge-yellow'
                          : 'badge-green'
                      }`}
                    >
                      {filledCount} / {totalCount} Players
                    </span>
                  </div>

                  {/* Player Seats Grid */}
                  <div className="room-seats-grid">
                    {r.players.map((p) => {
                      const isYou = savedSession && savedSession.playerID === p.id;
                      return (
                        <div
                          key={p.id}
                          className={`seat-chip ${
                            isYou
                              ? 'seat-you'
                              : p.name
                              ? 'seat-occupied'
                              : 'seat-empty'
                          }`}
                        >
                          <span className="seat-num">S{Number(p.id) + 1}:</span>
                          <span className="seat-name">
                            {p.name ? (isYou ? `${p.name} (You)` : p.name) : 'Open'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="room-card-actions">
                    {savedSession ? (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() =>
                          handleJoinSeat(r.matchID, savedSession.playerID, savedSession.playerName, r.gameName)
                        }
                        disabled={isThisRoomBusy || !!joiningMatchId}
                      >
                        <LogIn size={16} /> Rejoin Seat {Number(savedSession.playerID) + 1}
                      </button>
                    ) : openSeat ? (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => handleJoinSeat(r.matchID, openSeat.id, undefined, r.gameName)}
                        disabled={isThisRoomBusy || !!joiningMatchId}
                      >
                        <LogIn size={16} /> Join Seat {Number(openSeat.id) + 1}
                      </button>
                    ) : (
                      <button type="button" className="btn-secondary" disabled>
                        Room Full
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Host Match Modal (Online Multiplayer - Primary Mode) */}
      <ModalDialog
        isOpen={showHostModal}
        onClose={() => setShowHostModal(false)}
        title="Host an Online Room"
        subtitle="Create a room and invite others to join via match code"
        icon={<Globe size={18} />}
        actions={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowHostModal(false)}
              disabled={isCreatingRoom}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleCreateOnlineRoom}
              disabled={isCreatingRoom || !!joiningMatchId}
            >
              <Plus size={16} /> {isCreatingRoom ? 'Creating Room...' : 'Create & Join Match'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label" htmlFor="host-game-select">
            Selected Game
          </label>
          <select
            id="host-game-select"
            className="form-input"
            value={hostGameName}
            onChange={(e) => {
              setHostGameName(e.target.value);
              setHostNumPlayers(e.target.value === 'counter-example' ? 2 : 4);
            }}
          >
            <option value="so-clover">🍀 So Clover! (Word Deduction)</option>
            <option value="counter-example">⚡ Counter Duel (Quick Play)</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="host-players-select">
            Player Capacity
          </label>
          <select
            id="host-players-select"
            className="form-input"
            value={hostNumPlayers}
            onChange={(e) => setHostNumPlayers(Number(e.target.value))}
            disabled={isCreatingRoom || !!joiningMatchId}
          >
            {hostGameName === 'so-clover' ? (
              <>
                <option value={1}>1 Player (Solo Challenge)</option>
                <option value={2}>2 Players (Co-op Pair)</option>
                <option value={3}>3 Players</option>
                <option value={4}>4 Players (Standard)</option>
                <option value={5}>5 Players</option>
                <option value={6}>6 Players (Max)</option>
              </>
            ) : (
              <>
                <option value={1}>1 Player</option>
                <option value={2}>2 Players</option>
                <option value={3}>3 Players</option>
                <option value={4}>4 Players</option>
              </>
            )}
          </select>
        </div>

        {hostGameName === 'so-clover' && (
          <GameRoomSettings
            gameName={hostGameName}
            options={{ allowSingleCardRotation: hostAllowCardRotation }}
            onOptionsChange={(opts) => setHostAllowCardRotation(Boolean(opts.allowSingleCardRotation))}
            isHost={true}
          />
        )}

        <div className="form-group">
          <span className="form-hint">
            Hosting as <strong>{currentUser.username}</strong>. A match room will be created and you will occupy Seat 1.
          </span>
        </div>
      </ModalDialog>

      {/* Pass & Play Setup Modal (Local Offline - Secondary Mode) */}
      <ModalDialog
        isOpen={showLocalModal}
        onClose={() => setShowLocalModal(false)}
        title="Start Local Pass & Play"
        subtitle="Offline mode: take turns passing a single device"
        icon={<Smartphone size={18} />}
      >
        <form onSubmit={handleLaunchLocal} className="auth-form">
          <div className="form-group">
            <label className="form-label" htmlFor="local-game-select">
              Select Game
            </label>
            <select
              id="local-game-select"
              className="form-input"
              value={localGameName}
              onChange={(e) => setLocalGameName(e.target.value)}
            >
              <option value="so-clover">🍀 So Clover! (Pass & Play)</option>
              <option value="counter-example">⚡ Counter Duel (Local Demo)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="local-name-input">
              Your Display Name
            </label>
            <input
              id="local-name-input"
              type="text"
              className="form-input"
              value={localPlayerName}
              onChange={(e) => setLocalPlayerName(e.target.value)}
              placeholder="e.g. Alice"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="local-count-select">
              Number of Players
            </label>
            <select
              id="local-count-select"
              className="form-input"
              value={localNumPlayers}
              onChange={(e) => setLocalNumPlayers(Number(e.target.value))}
            >
              <option value={1}>1 Player (Solo Challenge)</option>
              <option value={2}>2 Players (Co-op)</option>
              <option value={3}>3 Players</option>
              <option value={4}>4 Players (Standard)</option>
              <option value={5}>5 Players</option>
              <option value={6}>6 Players</option>
            </select>
          </div>

          {localGameName === 'so-clover' && (
            <GameRoomSettings
              gameName={localGameName}
              options={{ allowSingleCardRotation: localAllowCardRotation }}
              onOptionsChange={(opts) => setLocalAllowCardRotation(Boolean(opts.allowSingleCardRotation))}
              isHost={true}
            />
          )}

          <div className="modal-actions-row">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowLocalModal(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              <Play size={16} /> Start Game Now
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
};

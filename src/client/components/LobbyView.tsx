import React, { useState, useEffect } from 'react';
import type { BaseRoom, MatchInfo } from '../../core/Room';
import { Users, Play, Plus, RefreshCw, Smartphone, Monitor, LogIn } from 'lucide-react';

export interface LobbyViewProps {
  roomManager: BaseRoom;
  onStartLocalGame: (numPlayers: number, playerName: string) => void;
  onJoinOnlineMatch: (matchID: string, playerID: string, playerName: string) => Promise<void> | void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  roomManager,
  onStartLocalGame,
  onJoinOnlineMatch
}) => {
  const [activeTab, setActiveTab] = useState<'local' | 'online'>('local');
  const [playerName, setPlayerName] = useState('Player 1');
  const [numPlayers, setNumPlayers] = useState(2);
  const [rooms, setRooms] = useState<MatchInfo[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [joiningMatchId, setJoiningMatchId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (activeTab === 'online') {
      const pollRooms = () => {
        roomManager
          .listRooms()
          .then((list) => {
            if (isMounted) {
              setRooms(list);
            }
          })
          .catch((e) => {
            console.warn('[LobbyView] Failed to list rooms:', e);
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
          console.warn('[LobbyView] Initial list rooms error:', e);
        })
        .finally(() => {
          if (isMounted) {
            setIsLoadingRooms(false);
          }
        });

      // Poll available rooms dynamically every 2.5s
      const timer = setInterval(pollRooms, 2500);

      return () => {
        isMounted = false;
        clearInterval(timer);
      };
    }
  }, [activeTab, roomManager]);

  const fetchRooms = async () => {
    setIsLoadingRooms(true);
    try {
      const list = await roomManager.listRooms();
      setRooms(list);
    } catch (e) {
      console.warn('[LobbyView] Failed to list rooms:', e);
    } finally {
      setIsLoadingRooms(false);
    }
  };

  const handleCreateOnlineRoom = async () => {
    // Guard: prevent double-click race — isCreatingRoom blocks before createRoom API call
    if (isCreatingRoom || joiningMatchId) return;

    const trimmedName = playerName.trim().slice(0, 50);
    if (!trimmedName) {
      alert('Please enter your nickname before creating a room.');
      return;
    }

    setIsCreatingRoom(true);
    let matchID: string | null = null;
    try {
      matchID = await roomManager.createRoom(numPlayers);
      setJoiningMatchId(matchID);
      await onJoinOnlineMatch(matchID, '0', trimmedName);
    } catch (err) {
      alert(`Could not create room on server: ${String(err)}`);
      setJoiningMatchId(null);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleJoinSeat = async (matchID: string, seatId: string, nameToUse?: string) => {
    if (joiningMatchId) return;
    const finalName = (nameToUse || playerName.trim()).slice(0, 50);
    if (!finalName) {
      alert('Please enter your nickname before joining.');
      return;
    }

    setJoiningMatchId(matchID);
    try {
      await onJoinOnlineMatch(matchID, seatId, finalName);
    } catch (err) {
      alert(`Failed to join room: ${String(err)}`);
      setJoiningMatchId(null);
    }
  };

  // Pre-compute saved sessions once per render cycle — avoids per-card localStorage reads inside .map()
  const savedSessionsByMatchId = React.useMemo(
    () => {
      const map: Record<string, ReturnType<typeof roomManager.getSavedSession>> = {};
      for (const r of rooms) {
        map[r.matchID] = roomManager.getSavedSession(r.matchID);
      }
      return map;
    },
    [rooms, roomManager]
  );

  return (
    <div className="lobby-wrapper">
      <div className="lobby-hero">
        <h1 className="lobby-hero-title">🍀 So Clover!</h1>
        <p className="lobby-hero-desc">
          A cooperative word-association deduction game. Link keywords with clever clues and work
          together to find the perfect clover matches!
        </p>

        <div className="lobby-mode-switch">
          <button
            type="button"
            className={`mode-tab ${activeTab === 'local' ? 'active' : ''}`}
            onClick={() => setActiveTab('local')}
          >
            <Smartphone size={16} /> Instant / Pass & Play
          </button>
          <button
            type="button"
            className={`mode-tab ${activeTab === 'online' ? 'active' : ''}`}
            onClick={() => setActiveTab('online')}
          >
            <Monitor size={16} /> Online Multiplayer
          </button>
        </div>
      </div>

      {activeTab === 'local' ? (
        <div className="lobby-card">
          <div className="lobby-card-header">
            <h3>Start Local Match</h3>
            <span className="badge badge-green">No server required</span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="local-player-name">Your Name</label>
            <input
              id="local-player-name"
              type="text"
              className="form-input"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="e.g. Alice"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="local-player-count">Number of Players (1-6)</label>
            <select
              id="local-player-count"
              className="form-input"
              value={numPlayers}
              onChange={(e) => setNumPlayers(Number(e.target.value))}
            >
              <option value={1}>1 Player (Solo Challenge)</option>
              <option value={2}>2 Players (Co-op)</option>
              <option value={3}>3 Players</option>
              <option value={4}>4 Players (Standard)</option>
              <option value={5}>5 Players</option>
              <option value={6}>6 Players (Max)</option>
            </select>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={() => onStartLocalGame(numPlayers, playerName)}
          >
            <Play size={18} /> Start Game Now
          </button>
        </div>
      ) : (
        <div className="lobby-card">
          <div className="lobby-card-header">
            <h3>Online Multiplayer Rooms</h3>
            <button
              type="button"
              className="btn-secondary"
              onClick={fetchRooms}
              disabled={isLoadingRooms}
            >
              <RefreshCw size={14} className={isLoadingRooms ? 'spin-animation' : ''} /> Refresh
            </button>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="online-player-name">Your Nickname</label>
            <input
              id="online-player-name"
              type="text"
              className="form-input"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your display name"
            />
          </div>

          <div className="quick-start-panel">
            <h4>Host a New Room</h4>
            <div className="form-group">
              <label className="form-label" htmlFor="online-player-count">Players</label>
              <select
                id="online-player-count"
                className="form-input"
                value={numPlayers}
                onChange={(e) => setNumPlayers(Number(e.target.value))}
                disabled={isCreatingRoom || !!joiningMatchId}
              >
                <option value={2}>2 Players</option>
                <option value={3}>3 Players</option>
                <option value={4}>4 Players</option>
                <option value={5}>5 Players</option>
                <option value={6}>6 Players</option>
              </select>
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={handleCreateOnlineRoom}
              disabled={isCreatingRoom || !!joiningMatchId}
            >
              <Plus size={18} /> {isCreatingRoom ? 'Creating Room...' : 'Create & Join Room'}
            </button>
          </div>

          <div className="form-group server-rooms-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label className="form-label">Live Server Rooms</label>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Auto-refreshes every 2.5s</span>
            </div>

            {rooms.length === 0 ? (
              <div className="empty-rooms-state">
                <Users size={32} />
                <p>No active rooms found on the server. Host one above to get started!</p>
              </div>
            ) : (
              <div className="room-grid">
                {rooms.map((r) => {
                  const savedSession = savedSessionsByMatchId[r.matchID];
                  const openSeat = r.players.find((p) => !p.name);
                  const isThisRoomBusy = joiningMatchId === r.matchID;

                  return (
                    <div key={r.matchID} className="room-item">
                      <div className="room-item-header">
                        <span className="room-item-id">Room #{r.matchID.slice(0, 6)}</span>
                        <span className="badge badge-green">
                          {r.players.filter((p) => p.name).length} / {r.players.length} Players
                        </span>
                      </div>

                      <div className="player-slots-list">
                        {r.players.map((p) => {
                          const isYou = savedSession && savedSession.playerID === p.id;
                          return (
                            <span
                              key={p.id}
                              className={`badge ${
                                isYou ? 'badge-green' : p.name ? 'badge-green' : 'badge-yellow'
                              }`}
                            >
                              Seat {Number(p.id) + 1}: {p.name ? `${p.name}${isYou ? ' (You)' : ''}` : 'Empty'}
                            </span>
                          );
                        })}
                      </div>

                      {savedSession ? (
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() =>
                            handleJoinSeat(r.matchID, savedSession.playerID, savedSession.playerName)
                          }
                          disabled={isThisRoomBusy || !!joiningMatchId}
                        >
                          <LogIn size={16} /> Rejoin Seat {Number(savedSession.playerID) + 1}
                        </button>
                      ) : openSeat ? (
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => handleJoinSeat(r.matchID, openSeat.id)}
                          disabled={isThisRoomBusy || !!joiningMatchId}
                        >
                          Join Seat {Number(openSeat.id) + 1}
                        </button>
                      ) : (
                        <button type="button" className="btn-secondary" disabled>
                          Room Full
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

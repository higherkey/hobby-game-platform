import React, { useState, useEffect } from 'react';
import type { BaseRoom, MatchInfo } from '../../core/Room';
import { Users, Play, Plus, RefreshCw, Smartphone, Monitor } from 'lucide-react';

export interface LobbyViewProps {
  roomManager: BaseRoom;
  onStartLocalGame: (numPlayers: number, playerName: string) => void;
  onJoinOnlineMatch: (matchID: string, playerID: string, playerName: string) => void;
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

  const fetchRooms = async () => {
    setIsLoadingRooms(true);
    try {
      const list = await roomManager.listRooms();
      setRooms(list);
    } catch (e) {
      console.warn('Failed to list rooms:', e);
    } finally {
      setIsLoadingRooms(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'online') {
      fetchRooms();
    }
  }, [activeTab]);

  const handleCreateOnlineRoom = async () => {
    setIsCreatingRoom(true);
    try {
      const matchID = await roomManager.createRoom(numPlayers);
      onJoinOnlineMatch(matchID, '0', playerName);
    } catch (err) {
      alert(`Could not create room on server: ${String(err)}`);
    } finally {
      setIsCreatingRoom(false);
    }
  };

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
              <RefreshCw size={14} /> Refresh
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
              disabled={isCreatingRoom}
            >
              <Plus size={18} /> Create & Join Room
            </button>
          </div>

          <div className="form-group server-rooms-section">
            <label className="form-label">Available Server Rooms</label>
            {rooms.length === 0 ? (
              <div className="empty-rooms-state">
                <Users size={32} />
                <p>No active rooms found on the server. Create one above to get started!</p>
              </div>
            ) : (
              <div className="room-grid">
                {rooms.map((r) => {
                  const openSeat = r.players.find((p) => !p.name);

                  return (
                    <div key={r.matchID} className="room-item">
                      <div className="room-item-header">
                        <span className="room-item-id">Room #{r.matchID.slice(0, 6)}</span>
                        <span className="badge badge-green">
                          {r.players.filter((p) => p.name).length} / {r.players.length} Players
                        </span>
                      </div>

                      <div className="player-slots-list">
                        {r.players.map((p) => (
                          <span
                            key={p.id}
                            className={`badge ${p.name ? 'badge-green' : 'badge-yellow'}`}
                          >
                            Seat {Number(p.id) + 1}: {p.name || 'Empty'}
                          </span>
                        ))}
                      </div>

                      {openSeat ? (
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => onJoinOnlineMatch(r.matchID, openSeat.id, playerName)}
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

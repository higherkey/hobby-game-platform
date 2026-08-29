import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Trash2,
  Plus,
  RefreshCw,
  Clock,
  Layers,
  ArrowLeft,
  KeyRound,
  AlertTriangle,
  Server
} from 'lucide-react';
import '../styles/admin.css';

export interface AdminRoomDetail {
  id: string;
  gameName: string;
  unlisted: boolean;
  isGameover: boolean;
  createdAt: number;
  updatedAt: number;
  players: Array<{ id: string; name?: string; isConnected?: boolean }>;
}

export interface AdminDashboardProps {
  onBackToLobby: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBackToLobby }) => {
  const [token, setToken] = useState<string>(() => {
    return sessionStorage.getItem('bgio_admin_token') || '';
  });
  const [tokenInput, setTokenInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVerifyingAuth, setIsVerifyingAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [rooms, setRooms] = useState<AdminRoomDetail[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [storageType, setStorageType] = useState<string>('postgres');

  // New room form state
  const [newGameName, setNewGameName] = useState('so-clover');
  const [newNumPlayers, setNewNumPlayers] = useState(2);
  const [newUnlisted, setNewUnlisted] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(
    null
  );

  const fetchRooms = useCallback(
    async (adminToken: string) => {
      setIsLoadingRooms(true);
      try {
        const res = await fetch('/api/admin/rooms', {
          headers: {
            'x-admin-token': adminToken
          }
        });

        if (res.status === 401) {
          setIsAuthenticated(false);
          sessionStorage.removeItem('bgio_admin_token');
          setAuthError('Admin session expired or token is invalid.');
          return;
        }

        const data = await res.json();
        if (data.data) {
          setRooms(data.data);
          setStorageType(data.storage || 'postgres');
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.error('[Admin] Fetch rooms error:', err);
      } finally {
        setIsLoadingRooms(false);
      }
    },
    []
  );

  // Authenticate token on mount if present
  useEffect(() => {
    if (token) {
      setIsVerifyingAuth(true);
      fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ token })
      })
        .then((res) => {
          if (res.ok) {
            setIsAuthenticated(true);
            fetchRooms(token);
          } else {
            sessionStorage.removeItem('bgio_admin_token');
            setIsAuthenticated(false);
          }
        })
        .catch(() => setIsAuthenticated(false))
        .finally(() => setIsVerifyingAuth(false));
    }
  }, [token, fetchRooms]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;

    setAuthError(null);
    setIsVerifyingAuth(true);

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenInput.trim() })
      });

      if (res.ok) {
        const validToken = tokenInput.trim();
        sessionStorage.setItem('bgio_admin_token', validToken);
        setToken(validToken);
        setIsAuthenticated(true);
        fetchRooms(validToken);
      } else {
        setAuthError('Invalid admin secret token.');
      }
    } catch (err) {
      setAuthError(`Connection error: ${String(err)}`);
    } finally {
      setIsVerifyingAuth(false);
    }
  };

  const handleKillRoom = async (matchID: string) => {
    if (!window.confirm(`Are you sure you want to terminate room #${matchID}? Any active players will be disconnected.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/rooms/${matchID}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': token }
      });

      if (res.ok) {
        setStatusMessage({ text: `Room #${matchID} was killed.`, type: 'success' });
        setRooms((prev) => prev.filter((r) => r.id !== matchID));
      } else {
        const data = await res.json();
        alert(`Failed to kill room: ${data.error?.message || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Error killing room: ${String(err)}`);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingRoom(true);

    try {
      const res = await fetch('/api/admin/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token
        },
        body: JSON.stringify({
          gameName: newGameName,
          numPlayers: newNumPlayers,
          unlisted: newUnlisted
        })
      });

      if (res.ok) {
        const data = await res.json();
        setStatusMessage({ text: `Created room #${data.matchID} (${newGameName})`, type: 'success' });
        fetchRooms(token);
      } else {
        const data = await res.json();
        alert(`Failed to create room: ${data.error?.message || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Error creating room: ${String(err)}`);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleRunCleanup = async () => {
    setIsCleaningUp(true);
    try {
      const res = await fetch('/api/admin/cleanup', {
        method: 'POST',
        headers: { 'x-admin-token': token },
        body: JSON.stringify({})
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMessage({
          text: `Cleaned up ${data.deletedCount} stale room(s).`,
          type: 'success'
        });
        fetchRooms(token);
      } else {
        alert(`Cleanup error: ${data.error?.message}`);
      }
    } catch (err) {
      alert(`Cleanup error: ${String(err)}`);
    } finally {
      setIsCleaningUp(false);
    }
  };

  const now = Date.now();
  const staleCutoff = 2 * 60 * 60 * 1000; // 2 hours
  const activeRoomsCount = rooms.filter((r) => !r.isGameover && now - r.updatedAt < staleCutoff).length;
  const staleRoomsCount = rooms.filter((r) => r.isGameover || now - r.updatedAt >= staleCutoff).length;

  if (!isAuthenticated) {
    return (
      <div className="token-modal-overlay">
        <div className="token-modal" role="dialog" aria-labelledby="admin-auth-title">
          <div className="token-modal-header">
            <KeyRound size={26} />
            <h2 id="admin-auth-title">Admin Access Gate</h2>
          </div>

          <p className="admin-card-subtitle">
            Enter your <code>ADMIN_SECRET</code> token to manage server rooms and maintenance tasks.
          </p>

          {authError && (
            <div className="badge badge-red">
              <AlertTriangle size={16} /> {authError}
            </div>
          )}

          <form onSubmit={handleLogin} className="form-group">
            <input
              type="password"
              className="form-input"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Enter ADMIN_SECRET token"
              autoFocus
            />

            <div className="token-modal-actions">
              <button
                type="button"
                className="btn-secondary token-btn-half"
                onClick={onBackToLobby}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary token-btn-half"
                disabled={isVerifyingAuth || !tokenInput.trim()}
              >
                {isVerifyingAuth ? 'Verifying...' : 'Authenticate'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <div className="admin-header-title">
          <ShieldAlert size={28} />
          Admin Room Management
        </div>

        <div className="admin-header-actions">
          <button type="button" className="btn-secondary" onClick={() => fetchRooms(token)} disabled={isLoadingRooms}>
            <RefreshCw size={16} className={isLoadingRooms ? 'spin-animation' : ''} /> Refresh
          </button>
          <button type="button" className="btn-secondary" onClick={onBackToLobby}>
            <ArrowLeft size={16} /> Exit to Lobby
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`badge ${statusMessage.type === 'success' ? 'badge-green' : 'badge-red'}`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* Metrics Row */}
      <div className="admin-metrics-grid">
        <div className="metric-card">
          <div className="metric-icon-wrapper">
            <Layers size={22} />
          </div>
          <div>
            <div className="metric-value">{rooms.length}</div>
            <div className="metric-label">Total Rooms</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrapper">
            <Clock size={22} />
          </div>
          <div>
            <div className="metric-value">{activeRoomsCount}</div>
            <div className="metric-label">Active / Live</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrapper warning">
            <AlertTriangle size={22} />
          </div>
          <div>
            <div className="metric-value">{staleRoomsCount}</div>
            <div className="metric-label">Stale / Game Over</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrapper">
            <Server size={22} />
          </div>
          <div>
            <div className="metric-value">
              {storageType}
            </div>
            <div className="metric-label">Database Mode</div>
          </div>
        </div>
      </div>

      {/* Manual Room Creator */}
      <div className="admin-card">
        <h3 className="admin-card-title">
          <span>Manually Spawn Room</span>
          <span className="admin-card-subtitle">Direct Server Matchmaker</span>
        </h3>

        <form onSubmit={handleCreateRoom} className="admin-form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="admin-game-select">Game</label>
            <select
              id="admin-game-select"
              className="form-input"
              value={newGameName}
              onChange={(e) => setNewGameName(e.target.value)}
            >
              <option value="so-clover">So Clover!</option>
              <option value="counter">Counter (Test Game)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="admin-players-select">Players</label>
            <select
              id="admin-players-select"
              className="form-input"
              value={newNumPlayers}
              onChange={(e) => setNewNumPlayers(Number(e.target.value))}
            >
              <option value={1}>1 Player</option>
              <option value={2}>2 Players</option>
              <option value={3}>3 Players</option>
              <option value={4}>4 Players</option>
              <option value={5}>5 Players</option>
              <option value={6}>6 Players</option>
            </select>
          </div>

          <div className="admin-checkbox-group">
            <input
              type="checkbox"
              id="admin-unlisted-check"
              checked={newUnlisted}
              onChange={(e) => setNewUnlisted(e.target.checked)}
            />
            <label htmlFor="admin-unlisted-check" className="admin-checkbox-label">
              Unlisted (Private)
            </label>
          </div>

          <button type="submit" className="btn-primary" disabled={isCreatingRoom}>
            <Plus size={16} /> {isCreatingRoom ? 'Spawning...' : 'Spawn Room'}
          </button>
        </form>
      </div>

      {/* Active Rooms Table */}
      <div className="admin-card">
        <div className="admin-card-title">
          <span>Active Server Rooms ({rooms.length})</span>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleRunCleanup}
            disabled={isCleaningUp}
          >
            <Clock size={14} /> {isCleaningUp ? 'Pruning...' : 'Prune Stale Rooms Now'}
          </button>
        </div>

        {rooms.length === 0 ? (
          <div className="admin-empty-state">
            No rooms currently registered on the server.
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Match ID</th>
                  <th>Game</th>
                  <th>Players / Seats</th>
                  <th>Status</th>
                  <th>Last Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => {
                  const minutesAgo = Math.floor((now - r.updatedAt) / 60000);
                  const isStale = r.isGameover || now - r.updatedAt >= staleCutoff;

                  return (
                    <tr key={r.id}>
                      <td className="admin-match-id">
                        #{r.id}
                        {r.unlisted && <span className="badge badge-yellow">Private</span>}
                      </td>
                      <td>{r.gameName}</td>
                      <td>
                        <span className="badge badge-green">
                          {r.players.filter((p) => p.name).length} / {r.players.length}
                        </span>
                        <span>
                          {r.players.map((p) => p.name || 'Empty').join(', ')}
                        </span>
                      </td>
                      <td>
                        {r.isGameover ? (
                          <span className="badge badge-yellow">Game Over</span>
                        ) : isStale ? (
                          <span className="badge badge-yellow">Stale</span>
                        ) : (
                          <span className="badge badge-green">In Progress</span>
                        )}
                      </td>
                      <td>
                        {minutesAgo < 1 ? 'Just now' : `${minutesAgo}m ago`}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={() => handleKillRoom(r.id)}
                          aria-label={`Kill room ${r.id}`}
                        >
                          <Trash2 size={14} /> Kill
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

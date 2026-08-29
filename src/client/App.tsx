import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { SoCloverGameState, Direction } from '../games/so-clover/types';
import { SoCloverGame } from '../games/so-clover/game';
import { BaseRoom, type GameClientType } from '../core/Room';
import { LobbyView } from './components/LobbyView';
import { CloverBoardView } from './components/CloverBoardView';
import { CardTray } from './components/CardTray';
import { ScoreView } from './components/ScoreView';
import {
  Sparkles,
  Smartphone,
  Monitor,
  CheckCircle2,
  ArrowRight,
  LogOut,
  Users,
  Eye
} from 'lucide-react';

export const App: React.FC = () => {
  const game = useMemo(() => new SoCloverGame(), []);
  const roomManager = useMemo(
    () =>
      new BaseRoom<SoCloverGameState>({
        gameName: game.name,
        game: game
      }),
    [game]
  );

  const [inGame, setInGame] = useState(false);
  const [isDesktopView, setIsDesktopView] = useState(false);
  const [gameState, setGameState] = useState<{ G: SoCloverGameState; ctx: any } | null>(null);
  const [clientInstance, setClientInstance] = useState<GameClientType<SoCloverGameState> | null>(null);

  // Local/Active viewer state
  const [localActivePlayerId, setLocalActivePlayerId] = useState('0');
  const [selectedPoolCardId, setSelectedPoolCardId] = useState<string | null>(null);
  const [clueDrafts, setClueDrafts] = useState<Record<string, { north: string; east: string; south: string; west: string }>>({});

  // Clean up client on unmount
  useEffect(() => {
    return () => {
      if (clientInstance) {
        clientInstance.stop();
      }
    };
  }, [clientInstance]);

  const handleStartLocalGame = useCallback((numPlayers: number, playerName: string) => {
    const client = roomManager.createGameClient({
      matchID: `local-${Date.now()}`,
      playerID: '0',
      multiplayerType: 'local'
    });

    client.start();

    // Initial setup with player names
    const playerNames: Record<string, string> = { '0': playerName };
    for (let i = 1; i < numPlayers; i++) {
      playerNames[String(i)] = `Player ${i + 1}`;
    }

    client.subscribe((state: any) => {
      if (state) {
        setGameState({ G: state.G, ctx: state.ctx });
      }
    });

    setClientInstance(client);
    setLocalActivePlayerId('0');
    setInGame(true);
  }, [roomManager]);

  const handleJoinOnlineMatch = useCallback(
    async (matchID: string, playerID: string, playerName: string) => {
      try {
        const session = await roomManager.joinRoom(matchID, playerID, playerName);
        const client = roomManager.createGameClient({
          matchID: session.matchID,
          playerID: session.playerID,
          credentials: session.playerCredentials,
          multiplayerType: 'socket'
        });

        client.start();
        client.subscribe((state: any) => {
          if (state) {
            setGameState({ G: state.G, ctx: state.ctx });
          }
        });

        setClientInstance(client);
        setLocalActivePlayerId(playerID);
        setInGame(true);
      } catch (err) {
        alert(`Failed to join online room: ${String(err)}`);
      }
    },
    [roomManager]
  );

  const handleLeaveGame = () => {
    if (clientInstance) {
      clientInstance.stop();
      setClientInstance(null);
    }
    setGameState(null);
    setInGame(false);
  };

  const handleClueDraftChange = (dir: Direction, val: string) => {
    setClueDrafts((prev) => ({
      ...prev,
      [localActivePlayerId]: {
        north: prev[localActivePlayerId]?.north || '',
        east: prev[localActivePlayerId]?.east || '',
        south: prev[localActivePlayerId]?.south || '',
        west: prev[localActivePlayerId]?.west || '',
        [dir]: val
      }
    }));
  };

  const handleSubmitClues = () => {
    if (!clientInstance || !gameState) return;
    const drafts = clueDrafts[localActivePlayerId] || {
      north: '',
      east: '',
      south: '',
      west: ''
    };

    if (!drafts.north || !drafts.east || !drafts.south || !drafts.west) {
      alert('Please fill in all 4 clues (North, East, South, West) before submitting.');
      return;
    }

    clientInstance.moves.submitClues(localActivePlayerId, drafts);
  };

  if (!inGame || !gameState) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="header-brand">
            <div className="header-logo">🍀</div>
            <span className="header-title">So Clover! Platform</span>
          </div>
        </header>
        <LobbyView
          roomManager={roomManager}
          onStartLocalGame={handleStartLocalGame}
          onJoinOnlineMatch={handleJoinOnlineMatch}
        />
      </div>
    );
  }

  const { G } = gameState;
  const isClueWriting = G.phase === 'clue_writing';
  const isResolution = G.phase === 'resolution';
  const isGameOver = G.phase === 'game_over';

  const spectatorId = G.playerOrder[G.currentSpectatorIndex] || '0';
  const activeBoard = isClueWriting
    ? G.players[localActivePlayerId]
    : G.players[spectatorId];

  const currentDraft = clueDrafts[localActivePlayerId] || {
    north: '',
    east: '',
    south: '',
    west: ''
  };

  const isCurrentSpectator = localActivePlayerId === spectatorId;
  const allSlotsFilled = activeBoard?.currentSlots.every((s) => s !== null);

  return (
    <div className="app-container">
      {/* Header with Game Info & Layout Switcher */}
      <header className="app-header">
        <div className="header-brand">
          <div className="header-logo">🍀</div>
          <span className="header-title">So Clover!</span>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className={`view-toggle-btn ${isDesktopView ? 'active' : ''}`}
            onClick={() => setIsDesktopView(!isDesktopView)}
            title="Toggle All-In-One Board View"
          >
            {isDesktopView ? (
              <>
                <Monitor size={16} /> Desktop View
              </>
            ) : (
              <>
                <Smartphone size={16} /> Mobile View
              </>
            )}
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={handleLeaveGame}
            title="Exit Room"
          >
            <LogOut size={16} /> Exit
          </button>
        </div>
      </header>

      {/* Main Game Area */}
      <div className="game-shell">
        {/* Info & Phase Banner */}
        <div className="game-info-bar">
          <div className="game-phase-indicator">
            <span className="phase-pill">{G.phase.replace('_', ' ')}</span>
            {isClueWriting && (
              <span>
                Writing Clues for <strong>{G.players[localActivePlayerId]?.playerName}</strong>
              </span>
            )}
            {isResolution && (
              <span>
                Resolving Clover for <strong>{activeBoard.playerName}</strong> (Spectator)
              </span>
            )}
          </div>

          <div className="game-stats">
            <div className="stat-item">
              <span>Team Score:</span>
              <span className="stat-val">
                {G.totalScore} / {G.maxPossibleScore}
              </span>
            </div>

            {/* Hotseat / Player Switcher for testing/multi-seat on single device */}
            {G.playerOrder.length > 1 && (
              <div className="stat-item">
                <Users size={14} />
                <select
                  value={localActivePlayerId}
                  onChange={(e) => setLocalActivePlayerId(e.target.value)}
                  className="form-input"
                >
                  {G.playerOrder.map((pid) => (
                    <option key={pid} value={pid}>
                      Seat: {G.players[pid].playerName}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Phase 1: Clue Writing Screen */}
        {isClueWriting && activeBoard && (
          <div className={`game-main-area ${isDesktopView ? 'desktop-board-view' : ''}`}>
            <div className="game-board-column">
              <div className="lobby-card clue-rules-banner">
                <p>
                  <strong>Secret Setup:</strong> Write 1 single-word clue for each outer pair of
                  keywords. When ready, click Submit.
                </p>
              </div>

              <CloverBoardView
                board={activeBoard}
                isClueWritingPhase={true}
                selectedCardId={null}
                clueDrafts={currentDraft}
                onClueDraftChange={handleClueDraftChange}
                onPlaceSelectedCard={() => {}}
                onRotateSlot={() => {}}
                onRemoveFromSlot={() => {}}
                readOnly={activeBoard.cluesSubmitted}
              />

              <div className="clue-actions-row">
                {activeBoard.cluesSubmitted ? (
                  <span className="badge badge-green">
                    <CheckCircle2 size={16} /> Clues submitted! Waiting for teammates...
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleSubmitClues}
                  >
                    <Sparkles size={18} /> Submit 4 Clues
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Phase 2: Resolution Screen */}
        {isResolution && activeBoard && (
          <div className={`game-main-area ${isDesktopView ? 'desktop-board-view' : ''}`}>
            {/* Board Column */}
            <div className="game-board-column">
              <div className="resolution-box">
                <div className="resolution-header">
                  <div>
                    <strong>{activeBoard.playerName}&apos;s Clover</strong>
                    {isCurrentSpectator && (
                      <span className="badge badge-yellow badge-spectator">
                        <Eye size={12} /> You are Spectator (Silent)
                      </span>
                    )}
                  </div>
                  <span
                    className={`attempt-badge ${
                      activeBoard.attemptNumber === 1 ? 'attempt-1' : 'attempt-2'
                    }`}
                  >
                    Attempt {activeBoard.attemptNumber} of 2
                  </span>
                </div>

                {activeBoard.isResolved ? (
                  <div className="badge badge-green badge-resolved">
                    <CheckCircle2 size={16} /> Board Resolved! Scored {activeBoard.score} points.
                  </div>
                ) : (
                  <p className="resolution-instruction-text">
                    Guessers: Place 4 keyword cards onto the clover board slots and rotate them to
                    match the 4 clues.
                  </p>
                )}
              </div>

              <CloverBoardView
                board={activeBoard}
                isClueWritingPhase={false}
                selectedCardId={selectedPoolCardId}
                onPlaceSelectedCard={(slotIdx) => {
                  if (selectedPoolCardId && clientInstance) {
                    const poolItem = activeBoard.cardPool.find(
                      (p) => p.card.id === selectedPoolCardId
                    );
                    clientInstance.moves.placeCard(
                      slotIdx,
                      selectedPoolCardId,
                      poolItem ? poolItem.rotation : 0
                    );
                    setSelectedPoolCardId(null);
                  }
                }}
                onRotateSlot={(slotIdx) => {
                  if (clientInstance) {
                    clientInstance.moves.rotateSlotCard(slotIdx);
                  }
                }}
                onRemoveFromSlot={(slotIdx) => {
                  if (clientInstance) {
                    clientInstance.moves.removeCard(slotIdx);
                  }
                }}
                readOnly={activeBoard.isResolved}
              />

              {/* Action Buttons */}
              <div className="board-actions-row">
                {!activeBoard.isResolved ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      if (clientInstance) {
                        clientInstance.moves.submitGuess();
                      }
                    }}
                    disabled={!allSlotsFilled}
                  >
                    <CheckCircle2 size={18} />
                    {activeBoard.attemptNumber === 1
                      ? 'Submit 1st Attempt (6 pts if perfect)'
                      : 'Submit 2nd Attempt'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      if (clientInstance) {
                        clientInstance.moves.nextSpectator();
                      }
                    }}
                  >
                    Next Player Board <ArrowRight size={18} />
                  </button>
                )}
              </div>
            </div>

            {/* Keyword Cards Tray Column */}
            {!activeBoard.isResolved && (
              <div className="game-tray-column">
                <CardTray
                  cardPool={activeBoard.cardPool}
                  selectedCardId={selectedPoolCardId}
                  onSelectCard={(cardId) => {
                    setSelectedPoolCardId((prev) => (prev === cardId ? null : cardId));
                  }}
                  onRotateCard={(cardId) => {
                    if (clientInstance) {
                      clientInstance.moves.rotatePoolCard(cardId);
                    }
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Phase 3: Game Over Screen */}
        {isGameOver && (
          <ScoreView
            G={G}
            onPlayAgain={() => {
              handleLeaveGame();
            }}
          />
        )}
      </div>
    </div>
  );
};

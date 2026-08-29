import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { SoCloverGameState, Direction } from '../games/so-clover/types';
import { SoCloverGame } from '../games/so-clover/game';
import { BaseRoom, type GameClientType } from '../core/Room';
import { LobbyView } from './components/LobbyView';
import { AdminDashboard } from './components/AdminDashboard';
import { CloverBoardView } from './components/CloverBoardView';
import { CardTray } from './components/CardTray';
import { ScoreView } from './components/ScoreView';
import {
  LogOut,
  Eye,
  Users,
  Smartphone,
  Monitor,
  RefreshCw,
  Shield,
  AlertTriangle,
  Sparkles,
  Layers,
  LayoutGrid,
  Check,
  CheckCircle2,
  Crown,
  ArrowRight
} from 'lucide-react';
import { createLogger, StructuredLogger } from '../core/Logger';

const logger = createLogger('App');

export const App: React.FC = () => {
  const [roomManager] = useState<BaseRoom<SoCloverGameState>>(() => {
    return new BaseRoom<SoCloverGameState>({
      gameName: 'so-clover',
      game: new SoCloverGame()
    });
  });

  const [inGame, setInGame] = useState(false);
  const [isAdminView, setIsAdminView] = useState(() => window.location.hash === '#admin');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isDesktopView, setIsDesktopView] = useState(false);
  const [focusMode, setFocusMode] = useState<'balanced' | 'board' | 'cards'>('balanced');
  const [peekMode, setPeekMode] = useState<'balanced' | 'board' | 'cards' | null>(null);
  const [showOverruleModal, setShowOverruleModal] = useState(false);

  const [gameState, setGameState] = useState<{ G: SoCloverGameState; ctx: any } | null>(null);
  const [clientInstance, setClientInstance] = useState<GameClientType<SoCloverGameState> | null>(null);
  const [activeSession, setActiveSession] = useState<{ matchID: string; playerID: string; credentials?: string } | null>(null);

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const connectingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Global telemetry beacon: transmit ERROR/WARN events to server
  useEffect(() => {
    const unsubscribe = StructuredLogger.addListener((event) => {
      if (event.level === 'ERROR' || event.level === 'WARN') {
        fetch('/api/telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event)
        }).catch(() => {});
      }
    });
    return unsubscribe;
  }, []);

  // Sync hash changes with admin view
  useEffect(() => {
    const handleHashChange = () => {
      setIsAdminView(window.location.hash === '#admin');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Local/Active viewer state
  const [localActivePlayerId, setLocalActivePlayerId] = useState('0');
  const [selectedPoolCardId, setSelectedPoolCardId] = useState<string | null>(null);
  const [clueDrafts, setClueDrafts] = useState<Record<string, { north: string; east: string; south: string; west: string }>>({});

  const handleStartLocalGame = useCallback((_numPlayers: number, _playerName: string) => {
    logger.info(`Starting local game with ${_numPlayers} player(s)`);
    unsubscribeRef.current?.();

    const client = roomManager.createGameClient({
      matchID: `local-${Date.now()}`,
      playerID: '0',
      multiplayerType: 'local'
    });

    client.start();

    const unsubscribe = client.subscribe((state: any) => {
      if (state) {
        setGameState({ G: state.G, ctx: state.ctx });
      }
    });
    unsubscribeRef.current = unsubscribe;

    setActiveSession(null);
    setClientInstance(client);
    setLocalActivePlayerId('0');
    setConnectionError(null);
    setInGame(true);
  }, [roomManager]);

  const handleLeaveGame = useCallback(() => {
    logger.info('Leaving active match and returning to lobby');
    if (connectingTimeoutRef.current) {
      clearTimeout(connectingTimeoutRef.current);
      connectingTimeoutRef.current = null;
    }
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;

    if (clientInstance) {
      try {
        clientInstance.stop();
      } catch (e) {
        logger.warn('Client stop error on leave', { error: String(e) });
      }
      setClientInstance(null);
    }
    if (activeSession) {
      roomManager.leaveRoom(activeSession.matchID, activeSession.playerID, activeSession.credentials).catch(console.warn);
      setActiveSession(null);
    }
    setGameState(null);
    setConnectionError(null);
    setInGame(false);
    setShowOverruleModal(false);
  }, [clientInstance, activeSession, roomManager]);

  const handleJoinOnlineMatch = useCallback(
    async (matchID: string, playerID: string, playerName: string) => {
      try {
        setConnectionError(null);
        setInGame(true);

        logger.info(`Connecting to online match ${matchID} (player: ${playerID}, name: ${playerName})...`);
        const session = await roomManager.joinRoom(matchID, playerID, playerName);

        if (connectingTimeoutRef.current) {
          clearTimeout(connectingTimeoutRef.current);
        }

        const client = roomManager.createGameClient({
          matchID: session.matchID,
          playerID: session.playerID,
          credentials: session.playerCredentials,
          multiplayerType: 'socket'
        });

        client.start();
        logger.info(`Socket client started for match ${matchID}`);

        // Listen for room termination by admin
        try {
          const transportSocket = (client as any).transport?.socket;
          if (transportSocket) {
            transportSocket.on('match_terminated', (data: any) => {
              if (data?.matchID === session.matchID) {
                logger.warn(`Match ${matchID} was terminated by admin`);
                alert('This room has been terminated by an administrator.');
                handleLeaveGame();
              }
            });
          }
        } catch (sockErr) {
          logger.warn('Could not attach match_terminated listener', { error: String(sockErr) });
        }

        // 8-second connection timeout with user-visible retry options
        connectingTimeoutRef.current = setTimeout(() => {
          logger.error(`Connection sync timed out after 8s for match ${session.matchID}`);
          setConnectionError('Connection timed out. The room may have expired or server credentials were not acknowledged.');
        }, 8000);

        let initialSyncReceived = false;
        const unsubscribe = client.subscribe((state: any) => {
          if (state) {
            if (!initialSyncReceived) {
              initialSyncReceived = true;
              logger.info(`First game state sync received from server (Turn: ${state.ctx?.turn}, Phase: ${state.G?.phase})`, {
                matchID: session.matchID,
                playerID: session.playerID
              });
            }
            if (connectingTimeoutRef.current) {
              clearTimeout(connectingTimeoutRef.current);
              connectingTimeoutRef.current = null;
            }
            setConnectionError(null);
            setGameState({ G: state.G, ctx: state.ctx });
          }
        });
        unsubscribeRef.current = unsubscribe;

        setActiveSession({
          matchID: session.matchID,
          playerID: session.playerID,
          credentials: session.playerCredentials
        });
        setClientInstance(client);
        setLocalActivePlayerId(playerID);
      } catch (err) {
        logger.error(`Failed to join online room ${matchID}`, { error: String(err) });
        setConnectionError(`Failed to join room: ${String(err)}`);
      }
    },
    [roomManager, handleLeaveGame]
  );

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

    logger.info(`Player ${localActivePlayerId} submitting clues`);
    clientInstance.moves.submitClues(localActivePlayerId, drafts);
  };

  // Render Admin Dashboard View
  if (isAdminView) {
    return (
      <div className="app-container">
        <AdminDashboard
          onBackToLobby={() => {
            window.location.hash = '';
            setIsAdminView(false);
          }}
        />
      </div>
    );
  }

  if (inGame && !gameState) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="header-brand">
            <div className="header-logo">🍀</div>
            <span className="header-title">So Clover!</span>
          </div>
          <button type="button" className="btn-secondary header-clearance-exit" onClick={handleLeaveGame}>
            <LogOut size={16} /> Cancel
          </button>
        </header>
        <div className="lobby-wrapper">
          <div className="loading-card" role="status" aria-live="polite">
            {connectionError ? (
              <>
                <AlertTriangle size={38} className="text-yellow-400" aria-label="Connection Error" />
                <h3>Connection Notice</h3>
                <p className="loading-desc">{connectionError}</p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1rem' }}>
                  {activeSession && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() =>
                        handleJoinOnlineMatch(activeSession.matchID, activeSession.playerID, 'Player')
                      }
                    >
                      <RefreshCw size={16} /> Retry Connection
                    </button>
                  )}
                  <button type="button" className="btn-secondary" onClick={handleLeaveGame}>
                    Back to Lobby
                  </button>
                </div>
              </>
            ) : (
              <>
                <RefreshCw
                  size={38}
                  className="loading-spinner"
                  aria-label="Connecting to game server"
                />
                <h3>Connecting to Room...</h3>
                <p className="loading-desc">
                  Synchronizing match state with the game server.
                </p>
                <button type="button" className="btn-secondary" onClick={handleLeaveGame}>
                  Back to Lobby
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!inGame || !gameState) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="header-brand">
            <div className="header-logo">🍀</div>
            <span className="header-title">So Clover! Platform</span>
          </div>
          <button
            type="button"
            className="btn-secondary header-clearance-exit"
            onClick={() => {
              window.location.hash = '#admin';
              setIsAdminView(true);
            }}
          >
            <Shield size={16} /> Admin
          </button>
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

  const numPlayers = G.playerOrder.length;
  const isCurrentSpectator = numPlayers > 1 && localActivePlayerId === spectatorId;
  const allSlotsFilled = activeBoard?.currentSlots.every((s) => s !== null);

  // Consensus & Lead Guesser derivations
  const leadGuesserId = numPlayers > 1
    ? G.playerOrder[(G.currentSpectatorIndex + 1) % numPlayers]
    : spectatorId;
  const isLeadGuesser = localActivePlayerId === leadGuesserId || numPlayers === 1;

  const guesserOrder = G.playerOrder.filter((pid) => pid !== spectatorId);
  const readyVotes = activeBoard?.readyVotes || [];
  const hasVotedReady = readyVotes.includes(localActivePlayerId);
  const isUnanimous = numPlayers <= 2 || readyVotes.length >= guesserOrder.length;

  const activeFocus = peekMode || focusMode;

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
            className="btn-secondary header-clearance-exit"
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
                Resolving Clover for <strong>{activeBoard.playerName}</strong> {isCurrentSpectator ? '(You - Silent Spectator)' : '(Spectator)'}
              </span>
            )}
          </div>

          <div className="game-stats">
            <div className="stat-item">
              <span>Team Score:</span>
              <span className="stat-val tabular-nums">
                {G.totalScore} / {G.maxPossibleScore}
              </span>
            </div>

            {/* Hotseat / Player Switcher only for local multi-seat play on single device */}
            {activeSession === null && G.playerOrder.length > 1 && (
              <div className="stat-item">
                <Users size={14} />
                <select
                  value={localActivePlayerId}
                  onChange={(e) => setLocalActivePlayerId(e.target.value)}
                  className="form-input"
                  aria-label="Change active seat"
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

        {/* Mobile 3-Mode Viewport Focus Switcher (Visible in Mobile View during Resolution) */}
        {isResolution && !isDesktopView && !activeBoard.isResolved && (
          <div className="mobile-focus-bar" role="toolbar" aria-label="Viewport Focus Controls">
            <button
              type="button"
              className={`focus-tab-btn ${activeFocus === 'board' ? 'active' : ''}`}
              onClick={() => setFocusMode('board')}
              onMouseDown={() => setPeekMode('board')}
              onMouseUp={() => setPeekMode(null)}
              onTouchStart={() => setPeekMode('board')}
              onTouchEnd={() => setPeekMode(null)}
              onContextMenu={(e) => e.preventDefault()}
              aria-pressed={focusMode === 'board'}
            >
              <LayoutGrid size={14} /> Focus Board
            </button>

            <button
              type="button"
              className={`focus-tab-btn ${activeFocus === 'balanced' ? 'active' : ''}`}
              onClick={() => setFocusMode('balanced')}
              aria-pressed={focusMode === 'balanced'}
            >
              <Layers size={14} /> Balanced View
            </button>

            <button
              type="button"
              className={`focus-tab-btn ${activeFocus === 'cards' ? 'active' : ''}`}
              onClick={() => setFocusMode('cards')}
              onMouseDown={() => setPeekMode('cards')}
              onMouseUp={() => setPeekMode(null)}
              onTouchStart={() => setPeekMode('cards')}
              onTouchEnd={() => setPeekMode(null)}
              onContextMenu={(e) => e.preventDefault()}
              aria-pressed={focusMode === 'cards'}
            >
              <Sparkles size={14} /> Focus Cards ({activeBoard.cardPool.length})
            </button>
          </div>
        )}

        {/* Phase 1: Clue Writing Screen */}
        {isClueWriting && activeBoard && (
          <div className={`game-main-area ${isDesktopView ? 'desktop-board-view' : ''}`}>
            <div className="game-board-column">
              <div className="clue-rules-banner">
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
          <div
            className={`game-main-area ${
              isDesktopView ? 'desktop-board-view' : `focus-mode-${activeFocus}`
            }`}
          >
            {/* Board Column */}
            <div className="game-board-column">
              {/* Spectator silent warning or Guesser header */}
              {isCurrentSpectator ? (
                <div className="spectator-silent-banner" role="alert">
                  <Eye size={16} /> You are the Spectator. Observe silently while your teammates discuss and deduce!
                </div>
              ) : (
                <div className="resolution-box">
                  <div className="resolution-header">
                    <div>
                      <strong>{activeBoard.playerName}&apos;s Clover</strong>
                      {isLeadGuesser && (
                        <span className="badge badge-lead">
                          <Crown size={12} /> You are Lead Guesser
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
                    <div className="badge badge-green">
                      <CheckCircle2 size={16} /> Board Resolved! Scored {activeBoard.score} points.
                    </div>
                  ) : (
                    <p className="resolution-instruction-text">
                      Guessers: Place 4 keyword cards onto the clover board slots and rotate them to
                      match the 4 clues.
                    </p>
                  )}
                </div>
              )}

              <CloverBoardView
                board={activeBoard}
                isClueWritingPhase={false}
                selectedCardId={selectedPoolCardId}
                onPlaceSelectedCard={(slotIdx: number) => {
                  if (selectedPoolCardId && clientInstance && !isCurrentSpectator) {
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
                onRotateSlot={(slotIdx: number) => {
                  if (clientInstance && !isCurrentSpectator) {
                    clientInstance.moves.rotateSlotCard(slotIdx);
                  }
                }}
                onRemoveFromSlot={(slotIdx: number) => {
                  if (clientInstance && !isCurrentSpectator) {
                    clientInstance.moves.removeCard(slotIdx);
                  }
                }}
                readOnly={activeBoard.isResolved || isCurrentSpectator}
              />

              {/* Team Consensus & Guesser Voting Bar (for 3+ players during active resolution) */}
              {!activeBoard.isResolved && !isCurrentSpectator && numPlayers >= 3 && (
                <div className="consensus-panel" role="region" aria-label="Team Consensus & Guesser Status">
                  <div className="consensus-header">
                    <span><strong>Team Consensus:</strong></span>
                    <span className="lead-guesser-badge">
                      Lead Guesser: {G.players[leadGuesserId]?.playerName} (Left of Spectator)
                    </span>
                  </div>

                  <div className="consensus-chips-row">
                    {guesserOrder.map((pid) => {
                      const isReady = readyVotes.includes(pid);
                      const isMe = pid === localActivePlayerId;
                      const isLead = pid === leadGuesserId;
                      return (
                        <span
                          key={pid}
                          className={`consensus-chip ${isReady ? 'ready' : 'thinking'}`}
                        >
                          {isReady ? <Check size={14} /> : <Users size={14} />}
                          {G.players[pid]?.playerName} {isLead ? '👑' : ''} {isMe ? '(You)' : ''}: {isReady ? 'Agreed' : 'Thinking'}
                        </span>
                      );
                    })}
                  </div>

                  <div className="consensus-actions-row">
                    <button
                      type="button"
                      className={`btn-secondary ${hasVotedReady ? 'active' : ''}`}
                      onClick={() => {
                        if (clientInstance) {
                          clientInstance.moves.toggleReadyVote(localActivePlayerId);
                        }
                      }}
                    >
                      <CheckCircle2 size={16} /> {hasVotedReady ? 'Revoke Ready Vote' : 'Vote Ready / Agree'}
                    </button>

                    {isLeadGuesser && (
                      <button
                        type="button"
                        className="btn-accent"
                        onClick={() => setShowOverruleModal(true)}
                        disabled={!allSlotsFilled}
                        title="Executive overrule in case of deadlock"
                      >
                        <AlertTriangle size={16} /> Invoke Overrule
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="board-actions-row">
                {!activeBoard.isResolved ? (
                  !isCurrentSpectator && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        if (clientInstance) {
                          clientInstance.moves.submitGuess(false);
                        }
                      }}
                      disabled={!allSlotsFilled || (numPlayers >= 3 && (!isUnanimous || !isLeadGuesser))}
                    >
                      <CheckCircle2 size={18} />
                      {numPlayers >= 3 && !isLeadGuesser
                        ? 'Waiting for Lead Guesser to Submit'
                        : numPlayers >= 3 && !isUnanimous
                        ? 'Waiting for Unanimous Agreement'
                        : activeBoard.attemptNumber === 1
                        ? 'Submit 1st Attempt (6 pts if perfect)'
                        : 'Submit 2nd Attempt'}
                    </button>
                  )
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
                  onSelectCard={(cardId: string) => {
                    if (!isCurrentSpectator) {
                      setSelectedPoolCardId((prev) => (prev === cardId ? null : cardId));
                    }
                  }}
                  onRotateCard={(cardId: string) => {
                    if (clientInstance && !isCurrentSpectator) {
                      clientInstance.moves.rotatePoolCard(cardId);
                    }
                  }}
                  disabled={isCurrentSpectator}
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

      {/* Safety-Gated Lead Guesser Overrule Modal */}
      {showOverruleModal && (
        <div className="overrule-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="overrule-modal-title">
          <div className="overrule-modal-card">
            <h3 id="overrule-modal-title" className="overrule-modal-title">
              <AlertTriangle size={22} /> Invoke Lead Guesser Overrule
            </h3>

            <div className="overrule-modal-warning">
              <p>
                <strong>As Lead Guesser</strong> (seated to the left of the spectator), you hold executive authority to submit the active clover board arrangement without unanimous team votes.
              </p>
              <p>
                Use this power deliberately to break deadlocks or indecision, ensuring thoughtful collaboration is respected.
              </p>
            </div>

            <div className="overrule-modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowOverruleModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-destructive"
                onClick={() => {
                  if (clientInstance) {
                    clientInstance.moves.submitGuess(true);
                  }
                  setShowOverruleModal(false);
                }}
              >
                Confirm & Submit Overrule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


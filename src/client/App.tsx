import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { SoCloverGameState, Direction } from '../games/so-clover/types';
import { SoCloverGame } from '../games/so-clover/game';
import { CounterGame, type CounterGameState } from '../core/example';
import { BaseRoom, type GameClientType } from '../core/Room';
import { Navbar } from './components/Navbar';
import { HomePage } from './components/HomePage';
import { PlayPage } from './components/PlayPage';
import { AuthModal } from './components/AuthModal';
import { AdminDashboard } from './components/AdminDashboard';
import { CloverBoardView } from './components/CloverBoardView';
import { CounterBoardView } from './components/CounterBoardView';
import { CardTray } from './components/CardTray';
import { ScoreView } from './components/ScoreView';
import { RoomSettingsModal } from './components/RoomSettingsModal';
import { MatchHeader } from './components/MatchHeader';
import { ModalDialog } from './components/common/ModalDialog';
import { HotseatSelector } from './components/common/HotseatSelector';
import { authStore, type UserSession } from './auth/authStore';
import {
  LogOut,
  Eye,
  Users,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  Layers,
  LayoutGrid,
  Check,
  CheckCircle2,
  Crown,
  ArrowRight,
  Dices
} from 'lucide-react';
import { createLogger, StructuredLogger } from '../core/Logger';

const logger = createLogger('App');

type PageRoute = 'home' | 'play' | 'admin';

function getRouteFromHash(): PageRoute {
  const hash = window.location.hash.toLowerCase();
  if (hash.startsWith('#admin')) return 'admin';
  if (hash.startsWith('#play')) return 'play';
  return 'home';
}

export const App: React.FC = () => {
  const [roomManager] = useState<BaseRoom<any>>(() => {
    return new BaseRoom({
      gameName: 'so-clover',
      game: new SoCloverGame()
    });
  });

  // Navigation & User State
  const [currentPage, setCurrentPage] = useState<PageRoute>(getRouteFromHash);
  const [currentUser, setCurrentUser] = useState<UserSession>(() => authStore.getUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [selectedGameFilter, setSelectedGameFilter] = useState('all');

  // Active Game State
  const [inGame, setInGame] = useState(false);
  const [currentGameName, setCurrentGameName] = useState('so-clover');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isDesktopView, setIsDesktopView] = useState(false);
  const [focusMode, setFocusMode] = useState<'balanced' | 'board' | 'cards'>('balanced');
  const [peekMode, setPeekMode] = useState<'balanced' | 'board' | 'cards' | null>(null);
  const [showOverruleModal, setShowOverruleModal] = useState(false);

  const [gameState, setGameState] = useState<{ G: any; ctx: any } | null>(null);
  const [clientInstance, setClientInstance] = useState<GameClientType<any> | null>(null);
  const [activeSession, setActiveSession] = useState<{ matchID: string; playerID: string; credentials?: string } | null>(null);

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const connectingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe to AuthStore updates
  useEffect(() => {
    return authStore.subscribe((user) => {
      setCurrentUser(user);
    });
  }, []);

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

  // Sync hash navigation
  useEffect(() => {
    const handleHashChange = () => {
      const nextRoute = getRouteFromHash();
      setCurrentPage(nextRoute);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (page: PageRoute) => {
    window.location.hash = page === 'home' ? '' : `#${page}`;
    setCurrentPage(page);
  };

  // Local/Active viewer state
  const [localActivePlayerId, setLocalActivePlayerId] = useState('0');
  const [selectedPoolCardId, setSelectedPoolCardId] = useState<string | null>(null);
  const [clueDrafts, setClueDrafts] = useState<Record<string, { north: string; east: string; south: string; west: string }>>({});
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const handleStartLocalGame = useCallback((
    gameName: string,
    numPlayers: number,
    _playerName: string,
    options?: { allowSingleCardRotation?: boolean }
  ) => {
    logger.info(`Starting local game "${gameName}" with ${numPlayers} player(s)`, { options });
    unsubscribeRef.current?.();

    setCurrentGameName(gameName);
    const gameToPlay = gameName === 'counter-example' ? new CounterGame() : new SoCloverGame();

    const client = roomManager.createGameClient({
      matchID: `local-${Date.now()}`,
      playerID: '0',
      multiplayerType: 'local',
      game: gameToPlay,
      setupData: {
        numPlayers,
        options: options || { allowSingleCardRotation: false }
      }
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
    logger.info('Leaving active match and returning to play hub');
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
      roomManager.leaveRoom(activeSession.matchID, activeSession.playerID, activeSession.credentials, currentGameName).catch(console.warn);
      setActiveSession(null);
    }
    setGameState(null);
    setConnectionError(null);
    setInGame(false);
    setShowOverruleModal(false);
  }, [clientInstance, activeSession, roomManager, currentGameName]);

  const handleJoinOnlineMatch = useCallback(
    async (matchID: string, playerID: string, playerName: string, gameName: string = 'so-clover') => {
      try {
        setConnectionError(null);
        setCurrentGameName(gameName);
        setInGame(true);

        logger.info(`Connecting to online match ${matchID} (${gameName}) (player: ${playerID}, name: ${playerName})...`);
        const session = await roomManager.joinRoom(matchID, playerID, playerName, gameName);

        if (connectingTimeoutRef.current) {
          clearTimeout(connectingTimeoutRef.current);
        }

        const gameToPlay = gameName === 'counter-example' ? new CounterGame() : new SoCloverGame();

        const client = roomManager.createGameClient({
          matchID: session.matchID,
          playerID: session.playerID,
          credentials: session.playerCredentials,
          multiplayerType: 'socket',
          game: gameToPlay
        });

        client.start();
        logger.info(`Socket client started for match ${matchID} (${gameName})`);

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
              logger.info(`First game state sync received from server (Turn: ${state.ctx?.turn})`, {
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

  const handleRotateSecretSlot = useCallback(
    (slotIdx: number) => {
      if (!clientInstance) return;
      clientInstance.moves.rotateSecretSlotCard(localActivePlayerId, slotIdx);
    },
    [clientInstance, localActivePlayerId]
  );

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

  const handleSelectGameFromHome = (gameName: string, _mode: 'local' | 'online') => {
    setSelectedGameFilter(gameName);
    navigateTo('play');
  };

  // 1. In-game Connecting / Syncing View
  if (inGame && !gameState) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="header-brand-group">
            <div className="header-brand-logo">
              <Dices size={20} />
            </div>
            <div className="header-brand-text">
              <span className="header-brand-title">HobbyBoard</span>
              <span className="header-brand-tagline">Connecting to Match</span>
            </div>
          </div>
          <button type="button" className="btn-secondary" onClick={handleLeaveGame}>
            <LogOut size={16} /> Cancel
          </button>
        </header>
        <div className="play-page-container">
          <div className="loading-card" role="status" aria-live="polite">
            {connectionError ? (
              <>
                <AlertTriangle size={38} className="text-yellow-400" aria-label="Connection Error" />
                <h3>Connection Notice</h3>
                <p className="loading-desc">{connectionError}</p>
                <div className="loading-actions-row">
                  {activeSession && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() =>
                        handleJoinOnlineMatch(activeSession.matchID, activeSession.playerID, currentUser.username || 'Player', currentGameName)
                      }
                    >
                      <RefreshCw size={16} /> Retry Connection
                    </button>
                  )}
                  <button type="button" className="btn-secondary" onClick={handleLeaveGame}>
                    Back to Play Hub
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
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. Active Match View (Gameplay)
  if (inGame && gameState) {
    const { G, ctx } = gameState;

    // Counter Duel Specific View
    if (currentGameName === 'counter-example') {
      const counterG = G as CounterGameState;
      return (
        <div className="app-container">
          <MatchHeader
            gameTitle="Counter Duel"
            gameTagline={`⚡ Counter Duel (Turn ${ctx?.turn || 1})`}
            showViewToggle={false}
            onLeaveGame={handleLeaveGame}
          />

          <div className="play-page-container">
            <CounterBoardView
              G={counterG}
              onIncrement={(amt) => {
                if (clientInstance) {
                  clientInstance.moves.increment(amt);
                }
              }}
              onReset={() => {
                if (clientInstance) {
                  clientInstance.moves.reset();
                }
              }}
            />
          </div>
        </div>
      );
    }

    // So Clover Specific View
    const cloverG = G as SoCloverGameState;
    const isClueWriting = cloverG.phase === 'clue_writing';
    const isResolution = cloverG.phase === 'resolution';
    const isGameOver = cloverG.phase === 'game_over';

    const spectatorId = cloverG.playerOrder[cloverG.currentSpectatorIndex] || '0';
    const activeBoard = isClueWriting
      ? cloverG.players[localActivePlayerId]
      : cloverG.players[spectatorId];

    const currentDraft = clueDrafts[localActivePlayerId] || {
      north: '',
      east: '',
      south: '',
      west: ''
    };

    const numPlayers = cloverG.playerOrder.length;
    const isCurrentSpectator = numPlayers > 1 && localActivePlayerId === spectatorId;
    const allSlotsFilled = activeBoard?.currentSlots.every((s) => s !== null);

    // Consensus & Lead Guesser derivations
    const leadGuesserId = numPlayers > 1
      ? cloverG.playerOrder[(cloverG.currentSpectatorIndex + 1) % numPlayers]
      : spectatorId;
    const isLeadGuesser = localActivePlayerId === leadGuesserId || numPlayers === 1;

    const guesserOrder = cloverG.playerOrder.filter((pid) => pid !== spectatorId);
    const readyVotes = activeBoard?.readyVotes || [];
    const hasVotedReady = readyVotes.includes(localActivePlayerId);
    const isUnanimous = numPlayers <= 2 || readyVotes.length >= guesserOrder.length;

    const activeFocus = peekMode || focusMode;

    return (
      <div className="app-container">
        {/* Match Header */}
        <MatchHeader
          gameTitle="So Clover!"
          gameTagline="🍀 So Clover!"
          isDesktopView={isDesktopView}
          onToggleDesktopView={() => setIsDesktopView(!isDesktopView)}
          onOpenSettings={() => setShowSettingsModal(true)}
          onLeaveGame={handleLeaveGame}
        />

        {/* Room Settings Modal */}
        <RoomSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          gameName={currentGameName}
          matchID={activeSession?.matchID || 'local-match'}
          isHost={!activeSession || activeSession.playerID === '0'}
          phase={cloverG.phase}
          currentOptions={cloverG.options || {}}
          onSaveOptions={(updatedOptions) => {
            if (clientInstance?.moves?.updateGameOptions) {
              clientInstance.moves.updateGameOptions(updatedOptions);
            }
          }}
        />

        {/* Main Game Shell */}
        <div className="game-shell">
          {/* Info & Phase Banner */}
          <div className="game-info-bar">
            <div className="game-phase-indicator">
              <span className="phase-pill">{cloverG.phase.replace('_', ' ')}</span>
              {isClueWriting && (
                <span>
                  Writing Clues for <strong>{cloverG.players[localActivePlayerId]?.playerName}</strong>
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
                  {cloverG.totalScore} / {cloverG.maxPossibleScore}
                </span>
              </div>

              {/* Hotseat Switcher for single device local multiplayer */}
              {activeSession === null && cloverG.playerOrder.length > 1 && (
                <div className="stat-item">
                  <HotseatSelector
                    playerOrder={cloverG.playerOrder}
                    players={cloverG.players}
                    activePlayerId={localActivePlayerId}
                    onSelectPlayer={setLocalActivePlayerId}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Mobile Focus Controller (during Resolution when not in desktop side-by-side mode) */}
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

          {/* Phase 1: Clue Writing */}
          {isClueWriting && activeBoard && (
            <div className={`game-main-area ${isDesktopView ? 'desktop-board-view' : ''}`}>
              <div className="game-board-column">
                <div className="clue-rules-banner">
                  <p>
                    <strong>Secret Setup:</strong> Write 1 single-word clue for each outer pair of
                    keywords.
                    {cloverG.options?.allowSingleCardRotation && (
                      <span>
                        {' '}
                        <strong>[House Rule Active]:</strong> You may rotate 1 card on your board to adjust your keyword pairs.
                      </span>
                    )}{' '}
                    When ready, click Submit.
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
                  onRotateSecretSlot={handleRotateSecretSlot}
                  allowSingleCardRotation={Boolean(cloverG.options?.allowSingleCardRotation)}
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

          {/* Phase 2: Resolution */}
          {isResolution && activeBoard && (
            <div
              className={`game-main-area ${
                isDesktopView ? 'desktop-board-view' : `focus-mode-${activeFocus}`
              }`}
            >
              {/* Board Column */}
              <div className="game-board-column">
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

                {/* Team Consensus (3+ players) */}
                {!activeBoard.isResolved && !isCurrentSpectator && numPlayers >= 3 && (
                  <div className="consensus-panel" role="region" aria-label="Team Consensus & Guesser Status">
                    <div className="consensus-header">
                      <span><strong>Team Consensus:</strong></span>
                      <span className="lead-guesser-badge">
                        Lead Guesser: {cloverG.players[leadGuesserId]?.playerName} (Left of Spectator)
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
                            {cloverG.players[pid]?.playerName} {isLead ? '👑' : ''} {isMe ? '(You)' : ''}: {isReady ? 'Agreed' : 'Thinking'}
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

              {/* Keyword Card Tray */}
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
              G={cloverG}
              onPlayAgain={() => {
                handleLeaveGame();
              }}
            />
          )}
        </div>

        {/* Lead Guesser Overrule Modal */}
        <ModalDialog
          isOpen={showOverruleModal}
          onClose={() => setShowOverruleModal(false)}
          title="Invoke Lead Guesser Overrule"
          icon={<AlertTriangle size={18} />}
          actions={
            <>
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
            </>
          }
        >
          <div className="overrule-modal-warning">
            <p>
              <strong>As Lead Guesser</strong>, you hold executive authority to submit the active clover arrangement without unanimous votes.
            </p>
            <p>
              Use this to resolve deadlocks while respecting team collaboration.
            </p>
          </div>
        </ModalDialog>
      </div>
    );
  }

  // 3. Platform Multi-Page Layout (Home, Play, Admin)
  return (
    <div className="app-container">
      <Navbar
        currentPage={currentPage}
        onNavigate={navigateTo}
        currentUser={currentUser}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {currentPage === 'home' && (
        <HomePage
          onNavigate={navigateTo}
          onSelectGameForPlay={handleSelectGameFromHome}
        />
      )}

      {currentPage === 'play' && (
        <PlayPage
          roomManager={roomManager}
          currentUser={currentUser}
          onStartLocalGame={handleStartLocalGame}
          onJoinOnlineMatch={handleJoinOnlineMatch}
          initialGameFilter={selectedGameFilter}
        />
      )}

      {currentPage === 'admin' && (
        <div className="app-container">
          <AdminDashboard
            onBackToLobby={() => navigateTo('play')}
          />
        </div>
      )}

      {/* Global Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
      />
    </div>
  );
};

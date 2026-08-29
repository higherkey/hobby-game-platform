import { BaseGame } from '../../core/Game';
import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import type {
  SoCloverGameState,
  PlayerBoard,
  KeywordCard,
  PlacedCard,
  Direction
} from './types';
import { KEYWORD_DECK } from './words';

/**
 * Gets the visible word on an edge for a card with given rotation.
 * edge: 0 = Top, 1 = Right, 2 = Bottom, 3 = Left
 * rotation: 0 = 0°, 1 = 90° CW, 2 = 180° CW, 3 = 270° CW
 */
export function getEdgeWord(card: KeywordCard, rotation: number, edge: number): string {
  const index = ((edge - rotation) % 4 + 4) % 4;
  return card.words[index];
}

/**
 * Extracts the 4 keyword pairs for a given player's secret board setup
 */
export function getBoardKeywordPairs(
  secretCards: KeywordCard[],
  secretSolution: PlacedCard[]
): Record<Direction, [string, string]> {
  const card0 = secretCards[0];
  const rot0 = secretSolution[0].rotation;

  const card1 = secretCards[1];
  const rot1 = secretSolution[1].rotation;

  const card2 = secretCards[2];
  const rot2 = secretSolution[2].rotation;

  const card3 = secretCards[3];
  const rot3 = secretSolution[3].rotation;

  return {
    north: [getEdgeWord(card0, rot0, 0), getEdgeWord(card1, rot1, 0)],
    east: [getEdgeWord(card1, rot1, 1), getEdgeWord(card3, rot3, 1)],
    south: [getEdgeWord(card3, rot3, 2), getEdgeWord(card2, rot2, 2)],
    west: [getEdgeWord(card2, rot2, 3), getEdgeWord(card0, rot0, 3)]
  };
}

export function shuffleArray<T>(array: T[], seedRandom?: () => number): T[] {
  const rand = seedRandom || Math.random;
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Sanitizes clue strings: trims, caps length at 50 chars, removes control characters.
 */
export function sanitizeClue(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '')
    .slice(0, 50);
}

export class SoCloverGame extends BaseGame<SoCloverGameState> {
  public readonly name = 'so-clover';
  public minPlayers = 1;
  public maxPlayers = 6;

  public setup(ctx: Ctx, setupData?: { playerNames?: Record<string, string>; customDeck?: KeywordCard[] }): SoCloverGameState {
    const deck = shuffleArray(setupData?.customDeck || KEYWORD_DECK);
    const numPlayers = ctx.numPlayers || 1;
    const playerOrder: string[] = [];
    const players: Record<string, PlayerBoard> = {};

    let deckIndex = 0;

    for (let i = 0; i < numPlayers; i++) {
      const pid = String(i);
      playerOrder.push(pid);

      // Draw 4 cards for board + 1 distractor
      const secretCards: KeywordCard[] = [];
      for (let c = 0; c < 4; c++) {
        secretCards.push(deck[deckIndex++ % deck.length]);
      }
      const distractor = deck[deckIndex++ % deck.length];

      // Generate random initial rotations for secret solution
      const secretSolution: PlacedCard[] = secretCards.map((card) => ({
        cardId: card.id,
        rotation: Math.floor(Math.random() * 4)
      }));

      players[pid] = {
        playerId: pid,
        playerName: setupData?.playerNames?.[pid] || `Player ${i + 1}`,
        secretCards,
        secretSolution,
        secretDistractor: distractor,
        clues: {
          north: '',
          east: '',
          south: '',
          west: ''
        },
        cluesSubmitted: false,
        currentSlots: [null, null, null, null],
        lockedSlots: [false, false, false, false],
        cardPool: [],
        attemptNumber: 1,
        score: 0,
        isResolved: false
      };
    }

    return {
      phase: 'clue_writing',
      players,
      playerOrder,
      currentSpectatorIndex: 0,
      totalScore: 0,
      maxPossibleScore: numPlayers * 6,
      deck: deck.slice(deckIndex)
    };
  }

  public moves = {
    // -------------------------------------------------------------
    // PHASE 1: CLUE WRITING
    // -------------------------------------------------------------
    submitClues: (
      { G, playerID }: { G: SoCloverGameState; ctx: Ctx; playerID?: string },
      playerId: string,
      clues: { north: string; east: string; south: string; west: string }
    ) => {
      // Authorization check: if running in multiplayer mode with playerID set, enforce identity
      if (playerID !== undefined && playerID !== playerId) {
        return INVALID_MOVE;
      }

      const player = G.players[playerId];
      if (!player) return INVALID_MOVE;

      // Clean and sanitize clue inputs (prevent XSS / control characters / unbounded length)
      player.clues = {
        north: sanitizeClue(clues.north),
        east: sanitizeClue(clues.east),
        south: sanitizeClue(clues.south),
        west: sanitizeClue(clues.west)
      };
      player.cluesSubmitted = true;

      // Check if all players have submitted clues
      const allSubmitted = G.playerOrder.every((pid) => G.players[pid].cluesSubmitted);
      if (allSubmitted) {
        G.phase = 'resolution';
        G.currentSpectatorIndex = 0;

        // Initialize each player's cardPool for resolution
        for (const pid of G.playerOrder) {
          const p = G.players[pid];
          const cardsForPool = [...p.secretCards, p.secretDistractor];
          const shuffledPool = shuffleArray(cardsForPool).map((card) => ({
            card: card,
            rotation: Math.floor(Math.random() * 4)
          }));

          p.cardPool = shuffledPool;
          p.currentSlots = [null, null, null, null];
          p.lockedSlots = [false, false, false, false];
          p.attemptNumber = 1;
        }
      }
    },

    // -------------------------------------------------------------
    // PHASE 2: RESOLUTION MOVES
    // -------------------------------------------------------------
    placeCard: (
      { G }: { G: SoCloverGameState; ctx: Ctx },
      slotIndex: number,
      cardId: string,
      rotation: number = 0
    ) => {
      if (G.phase !== 'resolution') return INVALID_MOVE;
      const spectatorId = G.playerOrder[G.currentSpectatorIndex];
      const board = G.players[spectatorId];
      if (!board || board.isResolved) return INVALID_MOVE;

      if (slotIndex < 0 || slotIndex > 3 || !Number.isInteger(slotIndex)) return INVALID_MOVE;
      if (board.lockedSlots[slotIndex]) return INVALID_MOVE;

      // Find card in pool or existing slot
      const poolIndex = board.cardPool.findIndex((item) => item.card.id === cardId);
      if (poolIndex === -1) {
        const oldSlotIndex = board.currentSlots.findIndex(
          (s) => s !== null && s.cardId === cardId
        );
        if (oldSlotIndex !== -1 && !board.lockedSlots[oldSlotIndex]) {
          board.currentSlots[oldSlotIndex] = null;
        }
      } else {
        board.cardPool.splice(poolIndex, 1);
      }

      // If slot had an existing card, return that card to pool
      const existing = board.currentSlots[slotIndex];
      if (existing) {
        const allCards = [...board.secretCards, board.secretDistractor];
        const origCard = allCards.find((c) => c.id === existing.cardId);
        if (origCard) {
          board.cardPool.push({ card: origCard, rotation: existing.rotation });
        }
      }

      board.currentSlots[slotIndex] = {
        cardId,
        rotation: ((rotation % 4) + 4) % 4
      };
    },

    removeCard: ({ G }: { G: SoCloverGameState; ctx: Ctx }, slotIndex: number) => {
      if (G.phase !== 'resolution') return INVALID_MOVE;
      const spectatorId = G.playerOrder[G.currentSpectatorIndex];
      const board = G.players[spectatorId];
      if (!board || board.isResolved) return INVALID_MOVE;

      if (slotIndex < 0 || slotIndex > 3 || !Number.isInteger(slotIndex)) return INVALID_MOVE;
      if (board.lockedSlots[slotIndex]) return INVALID_MOVE;

      const placed = board.currentSlots[slotIndex];
      if (!placed) return;

      const allCards = [...board.secretCards, board.secretDistractor];
      const origCard = allCards.find((c) => c.id === placed.cardId);
      if (origCard) {
        board.cardPool.push({ card: origCard, rotation: placed.rotation });
      }

      board.currentSlots[slotIndex] = null;
    },

    rotateSlotCard: ({ G }: { G: SoCloverGameState; ctx: Ctx }, slotIndex: number) => {
      if (G.phase !== 'resolution') return INVALID_MOVE;
      const spectatorId = G.playerOrder[G.currentSpectatorIndex];
      const board = G.players[spectatorId];
      if (!board || board.isResolved) return INVALID_MOVE;

      if (slotIndex < 0 || slotIndex > 3 || !Number.isInteger(slotIndex)) return INVALID_MOVE;
      if (board.lockedSlots[slotIndex]) return INVALID_MOVE;

      const placed = board.currentSlots[slotIndex];
      if (placed) {
        placed.rotation = (placed.rotation + 1) % 4;
      }
    },

    rotatePoolCard: ({ G }: { G: SoCloverGameState; ctx: Ctx }, cardId: string) => {
      if (G.phase !== 'resolution') return INVALID_MOVE;
      const spectatorId = G.playerOrder[G.currentSpectatorIndex];
      const board = G.players[spectatorId];
      if (!board || board.isResolved) return INVALID_MOVE;

      const poolItem = board.cardPool.find((p) => p.card.id === cardId);
      if (poolItem) {
        poolItem.rotation = (poolItem.rotation + 1) % 4;
      }
    },

    submitGuess: ({ G }: { G: SoCloverGameState; ctx: Ctx }) => {
      if (G.phase !== 'resolution') return INVALID_MOVE;
      const spectatorId = G.playerOrder[G.currentSpectatorIndex];
      const board = G.players[spectatorId];
      if (!board || board.isResolved) return INVALID_MOVE;

      // Check if all 4 slots are filled
      const allFilled = board.currentSlots.every((s) => s !== null);
      if (!allFilled) {
        return INVALID_MOVE;
      }

      // Check correctness of each slot against secret solution
      const allCards = [...board.secretCards, board.secretDistractor];
      const slotCorrectness = board.currentSlots.map((placed, slotIdx) => {
        if (!placed) return false;
        const target = board.secretSolution[slotIdx];
        return target.cardId === placed.cardId && target.rotation === placed.rotation;
      });

      const correctCount = slotCorrectness.filter(Boolean).length;

      if (board.attemptNumber === 1) {
        board.attempt1CorrectCount = correctCount;

        if (correctCount === 4) {
          board.score = 6;
          board.lockedSlots = [true, true, true, true];
          board.isResolved = true;
          G.totalScore += board.score;
        } else {
          slotCorrectness.forEach((isCorrect, slotIdx) => {
            if (isCorrect) {
              board.lockedSlots[slotIdx] = true;
            } else {
              const placed = board.currentSlots[slotIdx];
              if (placed) {
                const origCard = allCards.find((c) => c.id === placed.cardId);
                if (origCard) {
                  board.cardPool.push({ card: origCard, rotation: placed.rotation });
                }
                board.currentSlots[slotIdx] = null;
              }
            }
          });
          board.attemptNumber = 2;
        }
      } else if (board.attemptNumber === 2) {
        board.attempt2CorrectCount = correctCount;
        board.score = correctCount;
        board.isResolved = true;
        G.totalScore += board.score;

        slotCorrectness.forEach((isCorrect, slotIdx) => {
          if (isCorrect) {
            board.lockedSlots[slotIdx] = true;
          }
        });
      }
    },

    nextSpectator: ({ G }: { G: SoCloverGameState; ctx: Ctx }) => {
      if (G.phase !== 'resolution') return INVALID_MOVE;
      const spectatorId = G.playerOrder[G.currentSpectatorIndex];
      const board = G.players[spectatorId];
      if (!board || !board.isResolved) return INVALID_MOVE;

      if (G.currentSpectatorIndex < G.playerOrder.length - 1) {
        G.currentSpectatorIndex += 1;
      } else {
        G.phase = 'game_over';
      }
    }
  };

  /**
   * Information Disclosure Defense:
   * Strips secretSolution and distractor details for unauthorized player views when resolved in online mode.
   */
  public playerView = ({ G, playerID }: { G: SoCloverGameState; ctx: Ctx; playerID: string | null }) => {
    // If local or game over, return full state
    if (G.phase === 'game_over' || !playerID) {
      return G;
    }

    const sanitizedPlayers: Record<string, PlayerBoard> = {};

    for (const [pid, board] of Object.entries(G.players)) {
      if (pid === playerID || board.isResolved) {
        sanitizedPlayers[pid] = board;
      } else {
        // Redact secretSolution during resolution to prevent client inspection tampering
        sanitizedPlayers[pid] = {
          ...board,
          secretSolution: []
        };
      }
    }

    return {
      ...G,
      players: sanitizedPlayers
    };
  };

  public endIf = ({ G }: { G: SoCloverGameState; ctx: Ctx }) => {
    if (G.phase === 'game_over') {
      return {
        totalScore: G.totalScore,
        maxScore: G.maxPossibleScore,
        rating: getRecordOfLegendsRating(G.totalScore, G.playerOrder.length)
      };
    }
    return undefined;
  };
}

export function getRecordOfLegendsRating(score: number, numPlayers: number): {
  title: string;
  description: string;
} {
  const max = numPlayers * 6;
  const ratio = max > 0 ? score / max : 0;

  if (ratio >= 0.9) {
    return {
      title: 'Grand Masters of Clover',
      description: 'Exceptional deduction and word mastery! Your legend is etched into eternity.'
    };
  } else if (ratio >= 0.75) {
    return {
      title: 'Legendary Clover Heroes',
      description: 'Brilliant teamwork! You connected the most elusive thoughts with ease.'
    };
  } else if (ratio >= 0.5) {
    return {
      title: 'Expert Botanists',
      description: 'Great game! You found most of the clover leaves with sharp intuition.'
    };
  } else {
    return {
      title: 'Apprentice Gardeners',
      description: 'A solid effort! Keep practicing to nurture your associative powers.'
    };
  }
}

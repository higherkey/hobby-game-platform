import type { Ctx } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';
import { BaseGame } from '../../core/Game';
import { KEYWORD_DECK } from './words';
import type {
  SoCloverGameState,
  PlayerBoard,
  KeywordCard,
  PlacedCard,
  Direction
} from './types';

const KEYWORD_MAP = new Map<string, KeywordCard>(KEYWORD_DECK.map((c) => [c.id, c]));

export function getCardById(cardId: string): KeywordCard | undefined {
  return KEYWORD_MAP.get(cardId);
}

/**
 * Deterministic Fisher-Yates shuffle using an optional random generator function.
 */
export function shuffleArray<T>(array: T[], randFn?: () => number): T[] {
  const rand = randFn || (() => 0.5);
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Returns rotation value (0, 1, 2, 3) deterministically via ctx.random or fallback.
 */
function getRandomRotation(ctx?: Ctx, fallbackIndex: number = 0): number {
  const random = (ctx as any)?.random;
  if (random?.Die) {
    return random.Die(4) - 1;
  }
  if (random?.Number) {
    return Math.floor(random.Number() * 4);
  }
  return fallbackIndex % 4;
}

/**
 * Deterministic array shuffle via ctx.random or fallback.
 */
function shuffleWithCtx<T>(array: T[], ctx?: Ctx): T[] {
  const random = (ctx as any)?.random;
  if (random?.Shuffle) {
    return random.Shuffle([...array]);
  }
  if (random?.Number) {
    return shuffleArray(array, () => random.Number());
  }
  return [...array];
}

/**
 * Derives the outer edge keyword pair for a given direction based on placed cards and their rotations.
 *
 * Board Slot Layout (2x2 Grid):
 * [Slot 0: Top-Left]     [Slot 1: Top-Right]
 * [Slot 2: Bottom-Left]  [Slot 3: Bottom-Right]
 *
 * Outer Edges:
 * - North: Slot 0 top word + Slot 1 top word
 * - East:  Slot 1 right word + Slot 3 right word
 * - South: Slot 3 bottom word + Slot 2 bottom word
 * - West:  Slot 2 left word + Slot 0 left word
 */
export function getKeywordForEdge(
  slots: (PlacedCard | null)[],
  allCards: KeywordCard[],
  direction: Direction
): [string, string] {
  const getWordAtCardOrientation = (
    placed: PlacedCard | null,
    cardEdgeIndex: number // 0: Top, 1: Right, 2: Bottom, 3: Left in absolute board orientation
  ): string => {
    if (!placed) return '';
    const card = allCards.find((c) => c.id === placed.cardId);
    if (!card) return '';

    // Relative edge on the card considering rotation:
    // (cardEdgeIndex - rotation + 4) % 4
    const originalEdge = (cardEdgeIndex - placed.rotation + 4) % 4;
    return card.words[originalEdge] || '';
  };

  switch (direction) {
    case 'north':
      return [getWordAtCardOrientation(slots[0], 0), getWordAtCardOrientation(slots[1], 0)];
    case 'east':
      return [getWordAtCardOrientation(slots[1], 1), getWordAtCardOrientation(slots[3], 1)];
    case 'south':
      return [getWordAtCardOrientation(slots[3], 2), getWordAtCardOrientation(slots[2], 2)];
    case 'west':
      return [getWordAtCardOrientation(slots[2], 3), getWordAtCardOrientation(slots[0], 3)];
  }
}

/**
 * Derives the word for a single card edge given its rotation.
 */
export function getEdgeWord(
  card: KeywordCard,
  rotation: number,
  edgeIndex: number
): string {
  const originalEdge = (edgeIndex - rotation + 4) % 4;
  return card.words[originalEdge] || '';
}

/**
 * Returns keyword pairs for all 4 outer edges of a clover board.
 */
export function getBoardKeywordPairs(
  cards: KeywordCard[],
  solution: PlacedCard[]
): Record<Direction, [string, string]> {
  return {
    north: getKeywordForEdge(solution, cards, 'north'),
    east: getKeywordForEdge(solution, cards, 'east'),
    south: getKeywordForEdge(solution, cards, 'south'),
    west: getKeywordForEdge(solution, cards, 'west')
  };
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

  public setup(
    ctx: Ctx,
    setupData?: {
      playerNames?: Record<string, string>;
      customDeck?: KeywordCard[];
      options?: { allowSingleCardRotation?: boolean };
    }
  ): SoCloverGameState {
    const rawDeck = setupData?.customDeck || KEYWORD_DECK;
    const deck = shuffleWithCtx(rawDeck, ctx);
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

      // Generate deterministic initial rotations for secret solution
      const secretSolution: PlacedCard[] = secretCards.map((card, cardIdx) => ({
        cardId: card.id,
        rotation: getRandomRotation(ctx, i * 4 + cardIdx)
      }));

      const initialRotations = secretSolution.map((s) => s.rotation);

      players[pid] = {
        playerId: pid,
        playerName: setupData?.playerNames?.[pid] || `Player ${i + 1}`,
        secretCards,
        secretSolution,
        initialRotations,
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
        readyVotes: [],
        attemptNumber: 1,
        score: 0,
        isResolved: false
      };
    }

    return {
      phase: 'clue_writing',
      options: {
        allowSingleCardRotation: Boolean(setupData?.options?.allowSingleCardRotation)
      },
      players,
      playerOrder,
      currentSpectatorIndex: 0,
      totalScore: 0,
      maxPossibleScore: numPlayers * 6,
      deck: deck.slice(deckIndex % deck.length)
    };
  }

  public moves = {
    // -------------------------------------------------------------
    // PHASE 1: CLUE WRITING
    // -------------------------------------------------------------
    /**
     * House Rule Move: Rotate a single secret card slot during clue writing.
     * Enforces that at most 1 slot can be in a modified rotation state relative to initial deal.
     */
    rotateSecretSlotCard: (
      { G, playerID }: { G: SoCloverGameState; ctx: Ctx; playerID?: string },
      targetPlayerId: string,
      slotIndex: number
    ) => {
      if (G.phase !== 'clue_writing') return INVALID_MOVE;
      if (!G.options?.allowSingleCardRotation) return INVALID_MOVE;

      const pid = playerID !== undefined ? playerID : (targetPlayerId || '0');
      // In online mode with playerID set, prevent modifying another player's board
      if (playerID !== undefined && playerID !== targetPlayerId) {
        return INVALID_MOVE;
      }

      const player = G.players[pid];
      if (!player || player.cluesSubmitted) return INVALID_MOVE;
      if (slotIndex < 0 || slotIndex > 3 || !Number.isInteger(slotIndex)) return INVALID_MOVE;

      // Net-delta rotation check:
      // A slot j is actively rotated if secretSolution[j].rotation !== initialRotations[j]
      const modifiedSlotIndex = player.secretSolution.findIndex(
        (s, idx) => s.rotation !== player.initialRotations[idx]
      );

      // If another slot is already rotated away from initial rotation, enforce single-card constraint
      if (modifiedSlotIndex !== -1 && modifiedSlotIndex !== slotIndex) {
        return INVALID_MOVE;
      }

      player.secretSolution[slotIndex].rotation =
        (player.secretSolution[slotIndex].rotation + 1) % 4;
    },

    submitClues: (
      { G, ctx, playerID }: { G: SoCloverGameState; ctx: Ctx; playerID?: string },
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

        // Initialize each player's cardPool for resolution deterministically
        for (let pIdx = 0; pIdx < G.playerOrder.length; pIdx++) {
          const pid = G.playerOrder[pIdx];
          const p = G.players[pid];
          const cardsForPool = [...p.secretCards, p.secretDistractor];
          const shuffledPool = shuffleWithCtx(cardsForPool, ctx).map((card, cIdx) => ({
            card: card,
            rotation: getRandomRotation(ctx, pIdx * 5 + cIdx)
          }));

          p.cardPool = shuffledPool;
          p.currentSlots = [null, null, null, null];
          p.lockedSlots = [false, false, false, false];
          p.readyVotes = [];
          p.attemptNumber = 1;
        }
      }
    },

    // -------------------------------------------------------------
    // PHASE 2: RESOLUTION MOVES
    // -------------------------------------------------------------
    placeCard: (
      { G, playerID }: { G: SoCloverGameState; ctx: Ctx; playerID?: string },
      slotIndex: number,
      cardId: string,
      rotation: number = 0
    ) => {
      if (G.phase !== 'resolution') return INVALID_MOVE;
      const spectatorId = G.playerOrder[G.currentSpectatorIndex];
      const board = G.players[spectatorId];
      if (!board || board.isResolved) return INVALID_MOVE;

      // Authorization guard: The active spectator whose board is being guessed cannot place cards (unless solo)
      if (G.playerOrder.length > 1 && playerID !== undefined && playerID === spectatorId) {
        return INVALID_MOVE;
      }

      if (slotIndex < 0 || slotIndex > 3 || !Number.isInteger(slotIndex)) return INVALID_MOVE;
      if (board.lockedSlots[slotIndex]) return INVALID_MOVE;

      // Reset consensus votes on board modification
      board.readyVotes = [];

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
        const origCard = getCardById(existing.cardId);
        if (origCard) {
          board.cardPool.push({ card: origCard, rotation: existing.rotation });
        }
      }

      board.currentSlots[slotIndex] = {
        cardId,
        rotation: ((rotation % 4) + 4) % 4
      };
    },

    removeCard: (
      { G, playerID }: { G: SoCloverGameState; ctx: Ctx; playerID?: string },
      slotIndex: number
    ) => {
      if (G.phase !== 'resolution') return INVALID_MOVE;
      const spectatorId = G.playerOrder[G.currentSpectatorIndex];
      const board = G.players[spectatorId];
      if (!board || board.isResolved) return INVALID_MOVE;

      // Authorization guard: Spectator cannot manipulate slots (unless solo)
      if (G.playerOrder.length > 1 && playerID !== undefined && playerID === spectatorId) {
        return INVALID_MOVE;
      }

      if (slotIndex < 0 || slotIndex > 3 || !Number.isInteger(slotIndex)) return INVALID_MOVE;
      if (board.lockedSlots[slotIndex]) return INVALID_MOVE;

      // Reset consensus votes on board modification
      board.readyVotes = [];

      const placed = board.currentSlots[slotIndex];
      if (!placed) return;

      const origCard = getCardById(placed.cardId);
      if (origCard) {
        board.cardPool.push({ card: origCard, rotation: placed.rotation });
      }

      board.currentSlots[slotIndex] = null;
    },

    rotateSlotCard: (
      { G, playerID }: { G: SoCloverGameState; ctx: Ctx; playerID?: string },
      slotIndex: number
    ) => {
      if (G.phase !== 'resolution') return INVALID_MOVE;
      const spectatorId = G.playerOrder[G.currentSpectatorIndex];
      const board = G.players[spectatorId];
      if (!board || board.isResolved) return INVALID_MOVE;

      // Authorization guard: Spectator cannot manipulate slots (unless solo)
      if (G.playerOrder.length > 1 && playerID !== undefined && playerID === spectatorId) {
        return INVALID_MOVE;
      }

      if (slotIndex < 0 || slotIndex > 3 || !Number.isInteger(slotIndex)) return INVALID_MOVE;
      if (board.lockedSlots[slotIndex]) return INVALID_MOVE;

      // Reset consensus votes on rotation
      board.readyVotes = [];

      const placed = board.currentSlots[slotIndex];
      if (placed) {
        placed.rotation = (placed.rotation + 1) % 4;
      }
    },

    rotatePoolCard: (
      { G, playerID }: { G: SoCloverGameState; ctx: Ctx; playerID?: string },
      cardId: string
    ) => {
      if (G.phase !== 'resolution') return INVALID_MOVE;
      const spectatorId = G.playerOrder[G.currentSpectatorIndex];
      const board = G.players[spectatorId];
      if (!board || board.isResolved) return INVALID_MOVE;

      // Authorization guard: Spectator cannot manipulate pool (unless solo)
      if (G.playerOrder.length > 1 && playerID !== undefined && playerID === spectatorId) {
        return INVALID_MOVE;
      }

      // Reset consensus votes on rotation
      board.readyVotes = [];

      const poolItem = board.cardPool.find((p) => p.card.id === cardId);
      if (poolItem) {
        poolItem.rotation = (poolItem.rotation + 1) % 4;
      }
    },

    toggleReadyVote: (
      { G, playerID }: { G: SoCloverGameState; ctx: Ctx; playerID?: string },
      playerId?: string
    ) => {
      if (G.phase !== 'resolution') return INVALID_MOVE;
      const spectatorId = G.playerOrder[G.currentSpectatorIndex];
      const board = G.players[spectatorId];
      if (!board || board.isResolved) return INVALID_MOVE;

      const voterId = playerID !== undefined ? playerID : (playerId || '');
      if (!voterId) return INVALID_MOVE;

      // Spectator cannot vote on their own board in multiplayer
      if (G.playerOrder.length > 1 && voterId === spectatorId) {
        return INVALID_MOVE;
      }

      if (!board.readyVotes) {
        board.readyVotes = [];
      }

      if (board.readyVotes.includes(voterId)) {
        board.readyVotes = board.readyVotes.filter((id) => id !== voterId);
      } else {
        board.readyVotes.push(voterId);
      }
    },

    submitGuess: (
      { G, playerID }: { G: SoCloverGameState; ctx: Ctx; playerID?: string },
      isOverrule: boolean = false
    ) => {
      if (G.phase !== 'resolution') return INVALID_MOVE;
      const spectatorId = G.playerOrder[G.currentSpectatorIndex];
      const board = G.players[spectatorId];
      if (!board || board.isResolved) return INVALID_MOVE;

      const numPlayers = G.playerOrder.length;

      // Authorization guard: In multiplayer, spectator cannot submit guess on their own board
      if (numPlayers > 1 && playerID !== undefined && playerID === spectatorId) {
        return INVALID_MOVE;
      }

      // Lead guesser is seated immediately to the left of the spectator
      const leadGuesserId = numPlayers > 1
        ? G.playerOrder[(G.currentSpectatorIndex + 1) % numPlayers]
        : spectatorId;

      // For 3+ players: enforce Lead Guesser identity and unanimous consensus (unless overrule)
      if (numPlayers >= 3) {
        if (playerID !== undefined && playerID !== leadGuesserId) {
          return INVALID_MOVE;
        }
        const guesserCount = numPlayers - 1;
        const isUnanimous = (board.readyVotes || []).length >= guesserCount;
        if (!isUnanimous && !isOverrule) {
          return INVALID_MOVE;
        }
      } else if (numPlayers === 2) {
        // For 2 players: single guesser is lead guesser
        if (playerID !== undefined && playerID !== leadGuesserId) {
          return INVALID_MOVE;
        }
      }

      // Check if all 4 slots are filled
      const allFilled = board.currentSlots.every((s) => s !== null);
      if (!allFilled) {
        return INVALID_MOVE;
      }

      // Check correctness of each slot against secret solution
      const slotCorrectness = board.currentSlots.map((placed, slotIdx) => {
        if (!placed) return false;
        const target = board.secretSolution[slotIdx];
        if (!target) return false;
        return target.cardId === placed.cardId && target.rotation === placed.rotation;
      });

      const correctCount = slotCorrectness.filter(Boolean).length;

      // Reset ready votes on guess submission
      board.readyVotes = [];

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
                const origCard = getCardById(placed.cardId);
                if (origCard) {
                  board.cardPool.push({ card: origCard, rotation: placed.rotation });
                }
                board.currentSlots[slotIdx] = null;
              }
            }
          });
          board.attemptNumber = 2;
          board.readyVotes = [];
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
   * Information Disclosure Defense (Anti-Cheat Fog of War):
   * Strips secretSolution and secret cards for unauthorized player views when in online mode.
   * The board owner (author/spectator) retains full view of their secretSolution.
   * Once a board is resolved, full details are revealed to everyone.
   */
  public playerView = ({ G, playerID }: { G: SoCloverGameState; ctx: Ctx; playerID: string | null }) => {
    // If local hotseat or game over, return full state
    if (G.phase === 'game_over' || !playerID) {
      return G;
    }

    const sanitizedPlayers: Record<string, PlayerBoard> = {};

    for (const [pid, board] of Object.entries(G.players)) {
      if (pid === playerID || board.isResolved) {
        // Author or resolved board: full visibility
        sanitizedPlayers[pid] = board;
      } else {
        // Non-owner during active gameplay: redact secret solution, secret cards, distractor, and initialRotations
        sanitizedPlayers[pid] = {
          ...board,
          secretCards: [],
          secretSolution: [],
          initialRotations: [],
          secretDistractor: {
            id: '__hidden__',
            words: ['', '', '', '']
          }
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

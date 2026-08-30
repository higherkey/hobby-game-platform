export type Direction = 'north' | 'east' | 'south' | 'west';

export interface KeywordCard {
  id: string;
  // 4 words around the card: [0]=Top, [1]=Right, [2]=Bottom, [3]=Left
  words: [string, string, string, string];
}

export interface PlacedCard {
  cardId: string;
  // rotation: 0 = 0deg, 1 = 90deg clockwise, 2 = 180deg, 3 = 270deg
  rotation: number;
}

export interface ClueEntry {
  north: string;
  east: string;
  south: string;
  west: string;
}

export interface TargetKeywordPair {
  direction: Direction;
  word1: string;
  word2: string;
  cardIndex1: number;
  cardIndex2: number;
}

export interface SoCloverGameOptions {
  allowSingleCardRotation?: boolean; // House rule: allows rotating at most 1 card during clue writing
}

export interface PlayerBoard {
  playerId: string;
  playerName: string;
  // Original secret cards and rotations for slots 0, 1, 2, 3
  secretCards: KeywordCard[];
  secretSolution: PlacedCard[]; // Length 4: slot 0, 1, 2, 3
  initialRotations: number[]; // Initial dealt rotations [s0, s1, s2, s3] for net-rotation delta tracking
  secretDistractor: KeywordCard; // 5th card added to pool

  // The 4 clues written by the player
  clues: ClueEntry;
  cluesSubmitted: boolean;

  // Working state during resolution phase:
  // Slots 0, 1, 2, 3 on the board (null if empty)
  currentSlots: (PlacedCard | null)[];
  // Locked slots (e.g. verified correct from attempt 1)
  lockedSlots: boolean[];
  // Available cards in tray/pool for this board
  cardPool: {
    card: KeywordCard;
    rotation: number;
  }[];

  // Consensus ready votes by guessers during resolution
  readyVotes: string[];

  // Resolution outcome
  attemptNumber: 1 | 2;
  attempt1CorrectCount?: number;
  attempt2CorrectCount?: number;
  score: number;
  isResolved: boolean;
}

export interface SoCloverGameState {
  phase: 'clue_writing' | 'resolution' | 'game_over';
  options: SoCloverGameOptions;
  players: Record<string, PlayerBoard>;
  playerOrder: string[];
  currentSpectatorIndex: number;
  totalScore: number;
  maxPossibleScore: number;
  deck: KeywordCard[];
}

import { describe, it, expect } from 'vitest';
import { SoCloverGame, getEdgeWord, getBoardKeywordPairs, sanitizeClue } from './game';
import type { Ctx } from 'boardgame.io';
import type { KeywordCard } from './types';

describe('So Clover Game Engine', () => {
  const mockCard: KeywordCard = {
    id: 'mock-1',
    words: ['TopWord', 'RightWord', 'BottomWord', 'LeftWord']
  };

  it('sanitizes clue strings properly', () => {
    expect(sanitizeClue('  hello  ')).toBe('hello');
    expect(sanitizeClue('test\x00\x1Fcontrol')).toBe('testcontrol');
    expect(sanitizeClue('a'.repeat(100))).toHaveLength(50);
  });

  it('calculates rotated edge words accurately', () => {
    // Rotation 0: 0->TopWord, 1->RightWord, 2->BottomWord, 3->LeftWord
    expect(getEdgeWord(mockCard, 0, 0)).toBe('TopWord');
    expect(getEdgeWord(mockCard, 0, 1)).toBe('RightWord');
    expect(getEdgeWord(mockCard, 0, 2)).toBe('BottomWord');
    expect(getEdgeWord(mockCard, 0, 3)).toBe('LeftWord');

    // Rotation 1 (90 deg CW)
    expect(getEdgeWord(mockCard, 1, 0)).toBe('LeftWord');
    expect(getEdgeWord(mockCard, 1, 1)).toBe('TopWord');
    expect(getEdgeWord(mockCard, 1, 2)).toBe('RightWord');
    expect(getEdgeWord(mockCard, 1, 3)).toBe('BottomWord');

    // Rotation 2 (180 deg CW)
    expect(getEdgeWord(mockCard, 2, 0)).toBe('BottomWord');
    expect(getEdgeWord(mockCard, 2, 1)).toBe('LeftWord');
    expect(getEdgeWord(mockCard, 2, 2)).toBe('TopWord');
    expect(getEdgeWord(mockCard, 2, 3)).toBe('RightWord');

    // Rotation 3 (270 deg CW)
    expect(getEdgeWord(mockCard, 3, 0)).toBe('RightWord');
    expect(getEdgeWord(mockCard, 3, 1)).toBe('BottomWord');
    expect(getEdgeWord(mockCard, 3, 2)).toBe('LeftWord');
    expect(getEdgeWord(mockCard, 3, 3)).toBe('TopWord');
  });

  it('computes 4 board keyword pairs for North, East, South, West', () => {
    const cards: KeywordCard[] = [
      { id: 'c0', words: ['N0', 'E0', 'S0', 'W0'] },
      { id: 'c1', words: ['N1', 'E1', 'S1', 'W1'] },
      { id: 'c2', words: ['N2', 'E2', 'S2', 'W2'] },
      { id: 'c3', words: ['N3', 'E3', 'S3', 'W3'] }
    ];
    const solution = [
      { cardId: 'c0', rotation: 0 },
      { cardId: 'c1', rotation: 0 },
      { cardId: 'c2', rotation: 0 },
      { cardId: 'c3', rotation: 0 }
    ];

    const pairs = getBoardKeywordPairs(cards, solution);
    expect(pairs.north).toEqual(['N0', 'N1']);
    expect(pairs.east).toEqual(['E1', 'E3']);
    expect(pairs.south).toEqual(['S3', 'S2']);
    expect(pairs.west).toEqual(['W2', 'W0']);
  });

  it('handles full game flow with perfect 1st attempt deduction (+6 pts)', () => {
    const game = new SoCloverGame();
    const ctx = { numPlayers: 1, currentPlayer: '0', turn: 1 } as unknown as Ctx;
    const G = game.setup(ctx);

    expect(G.phase).toBe('clue_writing');
    expect(G.playerOrder).toEqual(['0']);
    const player = G.players['0'];
    expect(player.secretCards).toHaveLength(4);
    expect(player.secretDistractor).toBeDefined();

    // Submit clues
    game.moves.submitClues(
      { G, ctx },
      '0',
      { north: 'ClueN', east: 'ClueE', south: 'ClueS', west: 'ClueW' }
    );

    expect(G.phase).toBe('resolution');
    expect(player.cardPool).toHaveLength(5); // 4 + 1 distractor
    expect(player.currentSlots).toEqual([null, null, null, null]);

    // Place all 4 cards into exact solution slots and rotations
    for (let slot = 0; slot < 4; slot++) {
      const sol = player.secretSolution[slot];
      game.moves.placeCard({ G, ctx }, slot, sol.cardId, sol.rotation);
    }

    expect(player.cardPool).toHaveLength(1); // 1 distractor left in pool

    // Submit guess
    game.moves.submitGuess({ G, ctx });

    expect(player.score).toBe(6); // 1st try bonus: 6 points
    expect(player.isResolved).toBe(true);
    expect(G.totalScore).toBe(6);

    // Next spectator -> game over
    game.moves.nextSpectator({ G, ctx });
    expect(G.phase).toBe('game_over');

    const endResult = game.endIf({ G, ctx });
    expect(endResult?.totalScore).toBe(6);
    expect(endResult?.rating.title).toBe('Grand Masters of Clover');
  });

  it('redacts secretSolution for non-owners in playerView (anti-cheat)', () => {
    const game = new SoCloverGame();
    const ctx = { numPlayers: 2, currentPlayer: '0', turn: 1 } as unknown as Ctx;
    const G = game.setup(ctx);

    // View from player '1'
    const viewForPlayer1 = game.playerView({ G, ctx, playerID: '1' });
    expect(viewForPlayer1.players['1'].secretSolution).toHaveLength(4);
    // Player 0's secret solution should be redacted for player 1!
    expect(viewForPlayer1.players['0'].secretSolution).toEqual([]);
  });
});

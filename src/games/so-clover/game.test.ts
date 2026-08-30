import { describe, it, expect } from 'vitest';
import { SoCloverGame, getKeywordForEdge, sanitizeClue } from './game';
import { INVALID_MOVE } from 'boardgame.io/core';
import type { Ctx } from 'boardgame.io';
import type { KeywordCard, PlacedCard } from './types';

describe('So Clover Game Engine', () => {
  const mockCards: KeywordCard[] = [
    { id: 'c0', words: ['N0', 'E0', 'S0', 'W0'] },
    { id: 'c1', words: ['N1', 'E1', 'S1', 'W1'] },
    { id: 'c2', words: ['N2', 'E2', 'S2', 'W2'] },
    { id: 'c3', words: ['N3', 'E3', 'S3', 'W3'] },
    { id: 'c4', words: ['N4', 'E4', 'S4', 'W4'] }
  ];

  it('sanitizes clue strings properly', () => {
    expect(sanitizeClue('  hello  ')).toBe('hello');
    expect(sanitizeClue('test\x00\x1Fcontrol')).toBe('testcontrol');
    expect(sanitizeClue('a'.repeat(100))).toHaveLength(50);
  });

  it('computes edge keyword pairs for directions accurately', () => {
    const slots: PlacedCard[] = [
      { cardId: 'c0', rotation: 0 },
      { cardId: 'c1', rotation: 0 },
      { cardId: 'c2', rotation: 0 },
      { cardId: 'c3', rotation: 0 }
    ];

    expect(getKeywordForEdge(slots, mockCards, 'north')).toEqual(['N0', 'N1']);
    expect(getKeywordForEdge(slots, mockCards, 'east')).toEqual(['E1', 'E3']);
    expect(getKeywordForEdge(slots, mockCards, 'south')).toEqual(['S3', 'S2']);
    expect(getKeywordForEdge(slots, mockCards, 'west')).toEqual(['W2', 'W0']);
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

  it('handles 2nd attempt partial scoring when 1st attempt is imperfect', () => {
    const game = new SoCloverGame();
    const ctx = { numPlayers: 2, currentPlayer: '1', turn: 1 } as unknown as Ctx;
    const G = game.setup(ctx);

    // Submit clues for both players
    game.moves.submitClues({ G, ctx, playerID: '0' }, '0', { north: 'A', east: 'B', south: 'C', west: 'D' });
    game.moves.submitClues({ G, ctx, playerID: '1' }, '1', { north: 'E', east: 'F', south: 'G', west: 'H' });

    expect(G.phase).toBe('resolution');
    const board0 = G.players['0']; // Spectator 0's board

    // 1st attempt: Place 2 correct cards (slot 0 and slot 1) and 2 wrong cards (slot 2 and slot 3)
    const sol0 = board0.secretSolution[0];
    const sol1 = board0.secretSolution[1];
    game.moves.placeCard({ G, ctx, playerID: '1' }, 0, sol0.cardId, sol0.rotation);
    game.moves.placeCard({ G, ctx, playerID: '1' }, 1, sol1.cardId, sol1.rotation);
    // Place distractor in slot 2 and card 2 in slot 3 with wrong rotation
    game.moves.placeCard({ G, ctx, playerID: '1' }, 2, board0.secretDistractor.id, 0);
    const sol2 = board0.secretSolution[2];
    game.moves.placeCard({ G, ctx, playerID: '1' }, 3, sol2.cardId, (sol2.rotation + 1) % 4);

    // Submit first guess
    game.moves.submitGuess({ G, ctx, playerID: '1' });

    // Attempt 1 evaluation:
    expect(board0.attemptNumber).toBe(2);
    expect(board0.isResolved).toBe(false);
    expect(board0.lockedSlots[0]).toBe(true);
    expect(board0.lockedSlots[1]).toBe(true);
    expect(board0.lockedSlots[2]).toBe(false);
    expect(board0.lockedSlots[3]).toBe(false);
    expect(board0.currentSlots[2]).toBeNull();
    expect(board0.currentSlots[3]).toBeNull();
    expect(board0.cardPool).toHaveLength(3); // 2 wrong cards returned to pool + 1 remaining card

    // 2nd attempt: place correct remaining cards
    const sol3 = board0.secretSolution[3];
    game.moves.placeCard({ G, ctx, playerID: '1' }, 2, sol2.cardId, sol2.rotation);
    game.moves.placeCard({ G, ctx, playerID: '1' }, 3, sol3.cardId, sol3.rotation);

    // Submit second guess
    game.moves.submitGuess({ G, ctx, playerID: '1' });

    // Attempt 2 evaluation:
    expect(board0.isResolved).toBe(true);
    expect(board0.score).toBe(4); // 4 points (1 per card, no 1st attempt bonus)
    expect(G.totalScore).toBe(4);
  });

  it('rejects moves from the active spectator on their own board during resolution (authorization guard)', () => {
    const game = new SoCloverGame();
    const ctx = { numPlayers: 2, currentPlayer: '0', turn: 1 } as unknown as Ctx;
    const G = game.setup(ctx);

    game.moves.submitClues({ G, ctx, playerID: '0' }, '0', { north: 'A', east: 'B', south: 'C', west: 'D' });
    game.moves.submitClues({ G, ctx, playerID: '1' }, '1', { north: 'E', east: 'F', south: 'G', west: 'H' });

    // Current spectator is Player 0
    const board0 = G.players['0'];
    const cardToPlace = board0.cardPool[0].card.id;

    // Player 0 tries to place a card on their own board -> MUST BE REJECTED
    const resultPlace = game.moves.placeCard({ G, ctx, playerID: '0' }, 0, cardToPlace, 0);
    expect(resultPlace).toBe(INVALID_MOVE);

    // Player 0 tries to submit a guess on their own board -> MUST BE REJECTED
    const resultGuess = game.moves.submitGuess({ G, ctx, playerID: '0' });
    expect(resultGuess).toBe(INVALID_MOVE);

    // Player 1 (the guesser) CAN place cards
    const resultGuesser = game.moves.placeCard({ G, ctx, playerID: '1' }, 0, cardToPlace, 0);
    expect(resultGuesser).not.toBe(INVALID_MOVE);
  });

  it('redacts secretSolution, secretCards, and secretDistractor in playerView for non-owners (anti-cheat)', () => {
    const game = new SoCloverGame();
    const ctx = { numPlayers: 2, currentPlayer: '0', turn: 1 } as unknown as Ctx;
    const G = game.setup(ctx);

    // View from player '1'
    const viewForPlayer1 = game.playerView({ G, ctx, playerID: '1' });
    // Player 1 should see their own secret cards & solution
    expect(viewForPlayer1.players['1'].secretSolution).toHaveLength(4);
    expect(viewForPlayer1.players['1'].secretCards).toHaveLength(4);

    // Player 0's secrets MUST be redacted for player 1!
    expect(viewForPlayer1.players['0'].secretSolution).toEqual([]);
    expect(viewForPlayer1.players['0'].secretCards).toEqual([]);
    expect(viewForPlayer1.players['0'].secretDistractor.id).toBe('__hidden__');
  });

  it('rejects invalid moves such as out-of-bounds or placed cards into locked slots', () => {
    const game = new SoCloverGame();
    const ctx = { numPlayers: 2, currentPlayer: '1', turn: 1 } as unknown as Ctx;
    const G = game.setup(ctx);

    game.moves.submitClues({ G, ctx, playerID: '0' }, '0', { north: 'A', east: 'B', south: 'C', west: 'D' });
    game.moves.submitClues({ G, ctx, playerID: '1' }, '1', { north: 'E', east: 'F', south: 'G', west: 'H' });

    const cardId = G.players['0'].cardPool[0].card.id;

    // Out of bounds slot
    expect(game.moves.placeCard({ G, ctx, playerID: '1' }, 5, cardId, 0)).toBe(INVALID_MOVE);
    expect(game.moves.placeCard({ G, ctx, playerID: '1' }, -1, cardId, 0)).toBe(INVALID_MOVE);

    // Place and lock slot 0
    G.players['0'].lockedSlots[0] = true;
    expect(game.moves.placeCard({ G, ctx, playerID: '1' }, 0, cardId, 0)).toBe(INVALID_MOVE);
    expect(game.moves.removeCard({ G, ctx, playerID: '1' }, 0)).toBe(INVALID_MOVE);
  });

  describe('Unanimous Consensus & Lead Guesser Overrule Mechanics', () => {
    it('handles consensus voting, vote toggling, and resets on card manipulations in 3-player game', () => {
      const game = new SoCloverGame();
      const ctx = { numPlayers: 3, currentPlayer: '1', turn: 1 } as unknown as Ctx;
      const G = game.setup(ctx);

      game.moves.submitClues({ G, ctx, playerID: '0' }, '0', { north: 'A', east: 'B', south: 'C', west: 'D' });
      game.moves.submitClues({ G, ctx, playerID: '1' }, '1', { north: 'E', east: 'F', south: 'G', west: 'H' });
      game.moves.submitClues({ G, ctx, playerID: '2' }, '2', { north: 'I', east: 'J', south: 'K', west: 'L' });

      // Spectator is 0. Lead Guesser is (0 + 1) % 3 = 1. Guessers are 1 and 2.
      const board0 = G.players['0'];

      // Spectator 0 cannot vote
      expect(game.moves.toggleReadyVote({ G, ctx, playerID: '0' })).toBe(INVALID_MOVE);

      // Guesser 1 votes ready
      game.moves.toggleReadyVote({ G, ctx, playerID: '1' });
      expect(board0.readyVotes).toEqual(['1']);

      // Guesser 1 toggles off
      game.moves.toggleReadyVote({ G, ctx, playerID: '1' });
      expect(board0.readyVotes).toEqual([]);

      // Both guessers vote ready
      game.moves.toggleReadyVote({ G, ctx, playerID: '1' });
      game.moves.toggleReadyVote({ G, ctx, playerID: '2' });
      expect(board0.readyVotes).toEqual(['1', '2']);

      // Guesser 2 places a card -> readyVotes MUST auto-reset to empty
      const cardToPlace = board0.cardPool[0].card.id;
      game.moves.placeCard({ G, ctx, playerID: '2' }, 0, cardToPlace, 0);
      expect(board0.readyVotes).toEqual([]);

      // Guessers re-vote ready
      game.moves.toggleReadyVote({ G, ctx, playerID: '1' });
      game.moves.toggleReadyVote({ G, ctx, playerID: '2' });
      expect(board0.readyVotes).toEqual(['1', '2']);

      // Rotating a placed slot card resets readyVotes
      game.moves.rotateSlotCard({ G, ctx, playerID: '2' }, 0);
      expect(board0.readyVotes).toEqual([]);

      // Re-vote ready
      game.moves.toggleReadyVote({ G, ctx, playerID: '1' });
      expect(board0.readyVotes).toEqual(['1']);

      // Rotating a pool card resets readyVotes
      const poolCardId = board0.cardPool[0].card.id;
      game.moves.rotatePoolCard({ G, ctx, playerID: '2' }, poolCardId);
      expect(board0.readyVotes).toEqual([]);

      // Re-vote ready
      game.moves.toggleReadyVote({ G, ctx, playerID: '1' });
      expect(board0.readyVotes).toEqual(['1']);

      // Removing a card resets readyVotes
      game.moves.removeCard({ G, ctx, playerID: '2' }, 0);
      expect(board0.readyVotes).toEqual([]);
    });

    it('requires unanimous consensus for regular submitGuess in 3-player game, but permits gated Overrule by Lead Guesser', () => {
      const game = new SoCloverGame();
      const ctx = { numPlayers: 3, currentPlayer: '1', turn: 1 } as unknown as Ctx;
      const G = game.setup(ctx);

      game.moves.submitClues({ G, ctx, playerID: '0' }, '0', { north: 'A', east: 'B', south: 'C', west: 'D' });
      game.moves.submitClues({ G, ctx, playerID: '1' }, '1', { north: 'E', east: 'F', south: 'G', west: 'H' });
      game.moves.submitClues({ G, ctx, playerID: '2' }, '2', { north: 'I', east: 'J', south: 'K', west: 'L' });

      const board0 = G.players['0'];
      // Place 4 cards into slots
      for (let s = 0; s < 4; s++) {
        const sol = board0.secretSolution[s];
        game.moves.placeCard({ G, ctx, playerID: '1' }, s, sol.cardId, sol.rotation);
      }

      // Non-lead guesser (Player 2) tries to submit -> REJECTED
      expect(game.moves.submitGuess({ G, ctx, playerID: '2' })).toBe(INVALID_MOVE);

      // Lead guesser (Player 1) tries to submit without consensus -> REJECTED
      expect(game.moves.submitGuess({ G, ctx, playerID: '1' })).toBe(INVALID_MOVE);

      // Lead guesser invokes gated Overrule -> SUCCEEDS even without unanimous votes
      const overruleResult = game.moves.submitGuess({ G, ctx, playerID: '1' }, true);
      expect(overruleResult).not.toBe(INVALID_MOVE);
      expect(board0.isResolved).toBe(true);
      expect(board0.score).toBe(6);
    });

    it('allows Lead Guesser to submit when all guessers vote ready', () => {
      const game = new SoCloverGame();
      const ctx = { numPlayers: 3, currentPlayer: '1', turn: 1 } as unknown as Ctx;
      const G = game.setup(ctx);

      game.moves.submitClues({ G, ctx, playerID: '0' }, '0', { north: 'A', east: 'B', south: 'C', west: 'D' });
      game.moves.submitClues({ G, ctx, playerID: '1' }, '1', { north: 'E', east: 'F', south: 'G', west: 'H' });
      game.moves.submitClues({ G, ctx, playerID: '2' }, '2', { north: 'I', east: 'J', south: 'K', west: 'L' });

      const board0 = G.players['0'];
      for (let s = 0; s < 4; s++) {
        const sol = board0.secretSolution[s];
        game.moves.placeCard({ G, ctx, playerID: '1' }, s, sol.cardId, sol.rotation);
      }

      // Both guessers vote ready
      game.moves.toggleReadyVote({ G, ctx, playerID: '1' });
      game.moves.toggleReadyVote({ G, ctx, playerID: '2' });

      // Lead Guesser submits normally
      expect(game.moves.submitGuess({ G, ctx, playerID: '1' }, false)).not.toBe(INVALID_MOVE);
      expect(board0.isResolved).toBe(true);
    });
  });

  describe('House Rule: Single Card Rotation During Clue Writing', () => {
    it('rejects rotation moves when house rule is disabled (default)', () => {
      const game = new SoCloverGame();
      const ctx = { numPlayers: 1, currentPlayer: '0', turn: 1 } as unknown as Ctx;
      const G = game.setup(ctx); // Default: allowSingleCardRotation = false

      expect(G.options.allowSingleCardRotation).toBe(false);
      const res = game.moves.rotateSecretSlotCard({ G, ctx, playerID: '0' }, '0', 0);
      expect(res).toBe(INVALID_MOVE);
    });

    it('allows rotating a single card slot when house rule is enabled', () => {
      const game = new SoCloverGame();
      const ctx = { numPlayers: 1, currentPlayer: '0', turn: 1 } as unknown as Ctx;
      const G = game.setup(ctx, { options: { allowSingleCardRotation: true } });

      expect(G.options.allowSingleCardRotation).toBe(true);
      const player = G.players['0'];
      const initialRot0 = player.secretSolution[0].rotation;

      // Rotate slot 0 once (+90 deg)
      game.moves.rotateSecretSlotCard({ G, ctx, playerID: '0' }, '0', 0);
      expect(player.secretSolution[0].rotation).toBe((initialRot0 + 1) % 4);

      // Rotate slot 0 again (+90 deg -> 180 deg)
      game.moves.rotateSecretSlotCard({ G, ctx, playerID: '0' }, '0', 0);
      expect(player.secretSolution[0].rotation).toBe((initialRot0 + 2) % 4);

      // Attempting to rotate a DIFFERENT slot (slot 1) while slot 0 is modified -> REJECTED
      const diffSlotRes = game.moves.rotateSecretSlotCard({ G, ctx, playerID: '0' }, '0', 1);
      expect(diffSlotRes).toBe(INVALID_MOVE);

      // Rotating slot 0 two more times (back to initial deal rotation) -> unlocks other slots
      game.moves.rotateSecretSlotCard({ G, ctx, playerID: '0' }, '0', 0);
      game.moves.rotateSecretSlotCard({ G, ctx, playerID: '0' }, '0', 0);
      expect(player.secretSolution[0].rotation).toBe(initialRot0);

      // Now rotating slot 1 is allowed
      const initialRot1 = player.secretSolution[1].rotation;
      const slot1Res = game.moves.rotateSecretSlotCard({ G, ctx, playerID: '0' }, '0', 1);
      expect(slot1Res).not.toBe(INVALID_MOVE);
      expect(player.secretSolution[1].rotation).toBe((initialRot1 + 1) % 4);
    });

    it('rejects rotation after clues are submitted or in resolution phase', () => {
      const game = new SoCloverGame();
      const ctx = { numPlayers: 1, currentPlayer: '0', turn: 1 } as unknown as Ctx;
      const G = game.setup(ctx, { options: { allowSingleCardRotation: true } });

      game.moves.submitClues({ G, ctx, playerID: '0' }, '0', {
        north: 'N',
        east: 'E',
        south: 'S',
        west: 'W'
      });

      expect(G.phase).toBe('resolution');
      const res = game.moves.rotateSecretSlotCard({ G, ctx, playerID: '0' }, '0', 0);
      expect(res).toBe(INVALID_MOVE);
    });

    it('prevents opponents from rotating other players boards in online multiplayer', () => {
      const game = new SoCloverGame();
      const ctx = { numPlayers: 2, currentPlayer: '0', turn: 1 } as unknown as Ctx;
      const G = game.setup(ctx, { options: { allowSingleCardRotation: true } });

      // Player 0 tries to rotate Player 1's secret card -> REJECTED
      const res = game.moves.rotateSecretSlotCard({ G, ctx, playerID: '0' }, '1', 0);
      expect(res).toBe(INVALID_MOVE);
    });
  });
});

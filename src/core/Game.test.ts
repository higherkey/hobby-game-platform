import { describe, it, expect } from 'vitest';
import { BaseGame, assertJsonSerializable } from './Game';
import type { Ctx } from 'boardgame.io';

describe('BaseGame and assertJsonSerializable', () => {
  it('allows valid JSON serializable state', () => {
    const valid = {
      name: 'Alice',
      age: 30,
      scores: [10, 20, 30],
      active: true,
      data: {
        nested: 'value',
        nil: null
      }
    };
    expect(() => assertJsonSerializable(valid)).not.toThrow();
  });

  it('allows valid Directed Acyclic Graphs (DAGs) with shared object references', () => {
    const sharedChild = { id: 'card-1', text: 'apple' };
    const dagState = {
      player1: { selected: sharedChild },
      player2: { preview: sharedChild },
      tray: [sharedChild]
    };
    expect(() => assertJsonSerializable(dagState)).not.toThrow();
  });

  it('rejects circular references and prevents call stack exhaustion', () => {
    const circularObj: any = { name: 'cycle' };
    circularObj.self = circularObj;

    expect(() => assertJsonSerializable(circularObj)).toThrowError(/Circular reference detected/);
  });

  it('rejects functions in state', () => {
    const invalid = {
      count: 0,
      fn: () => {}
    };
    expect(() => assertJsonSerializable(invalid)).toThrowError(/Illegal function detected/);
  });

  it('rejects class instances in state', () => {
    class CustomClass {
      val = 123;
    }
    const invalid = {
      obj: new CustomClass()
    };
    expect(() => assertJsonSerializable(invalid)).toThrowError(/Class instance "CustomClass" detected/);
  });

  it('rejects symbols in state', () => {
    const invalid = {
      sym: Symbol('test')
    };
    expect(() => assertJsonSerializable(invalid)).toThrowError(/Illegal Symbol detected/);
  });

  it('rejects BigInt in state', () => {
    const invalid = {
      big: BigInt(9007199254740991)
    };
    expect(() => assertJsonSerializable(invalid)).toThrowError(/Illegal BigInt detected/);
  });

  it('rejects non-finite numbers (NaN and Infinity)', () => {
    expect(() => assertJsonSerializable({ val: NaN })).toThrowError(/Non-finite number/);
    expect(() => assertJsonSerializable({ val: Infinity })).toThrowError(/Non-finite number/);
    expect(() => assertJsonSerializable({ val: -Infinity })).toThrowError(/Non-finite number/);
  });

  it('wraps setup and moves with validation in BaseGame', () => {
    interface TestState {
      count: number;
    }

    class TestGame extends BaseGame<TestState> {
      public readonly name = 'test-game';
      public setup(_ctx: Ctx): TestState {
        return { count: 0 };
      }
      public moves = {
        add: ({ G }: { G: TestState }, n: number) => {
          G.count += n;
        }
      };
    }

    const game = new TestGame();
    const config = game.toBoardgameConfig();

    expect(config.name).toBe('test-game');
    const initialG = (config.setup as any)({ ctx: {} as Ctx });
    expect(initialG).toEqual({ count: 0 });

    const context = { G: initialG, ctx: {} as Ctx };
    const addMove = config.moves?.add as any;
    addMove(context, 5);
    expect(context.G.count).toBe(5);
  });
});

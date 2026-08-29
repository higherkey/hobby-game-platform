import type { Game as BoardgameGame, Ctx, PhaseConfig, StageConfig } from 'boardgame.io';

export type GameStateValidator = (state: unknown) => boolean;

/**
 * Validates that an object is strictly JSON-serializable (plain objects, arrays, primitives, null).
 * Rejects functions, class instances (except plain Object/Array), Symbols, non-finite numbers, etc.
 */
export function assertJsonSerializable(
  value: unknown,
  path = 'G',
  ancestors: Set<unknown> = new Set()
): void {
  if (value === null || value === undefined) {
    return;
  }

  const type = typeof value;

  if (type === 'function') {
    throw new TypeError(`[Game State Validation Error] Illegal function detected in game state at "${path}". G must be strictly JSON-serializable.`);
  }

  if (type === 'symbol') {
    throw new TypeError(`[Game State Validation Error] Illegal Symbol detected in game state at "${path}". G must be strictly JSON-serializable.`);
  }

  if (type === 'bigint') {
    throw new TypeError(`[Game State Validation Error] Illegal BigInt detected in game state at "${path}". G must be strictly JSON-serializable.`);
  }

  if (type === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`[Game State Validation Error] Non-finite number (${value}) detected at "${path}".`);
    }
    return;
  }

  if (type === 'string' || type === 'boolean') {
    return;
  }

  if (type === 'object') {
    if (ancestors.has(value)) {
      throw new TypeError(`[Game State Validation Error] Circular reference detected in game state at "${path}". G must be strictly JSON-serializable without cycles.`);
    }

    // Check if it's a plain object or Array
    const proto = Object.getPrototypeOf(value);
    const isPlainObject = proto === null || proto === Object.prototype;
    const isArray = Array.isArray(value);

    if (!isPlainObject && !isArray) {
      const className = value.constructor ? value.constructor.name : 'UnknownClass';
      throw new TypeError(
        `[Game State Validation Error] Class instance "${className}" detected at "${path}". G must only contain plain objects, arrays, and primitive values.`
      );
    }

    ancestors.add(value);

    try {
      // Check children recursively
      if (isArray) {
        const arr = value as unknown[];
        for (let i = 0; i < arr.length; i++) {
          assertJsonSerializable(arr[i], `${path}[${i}]`, ancestors);
        }
      } else {
        const obj = value as Record<string, unknown>;
        for (const [key, val] of Object.entries(obj)) {
          assertJsonSerializable(val, `${path}.${key}`, ancestors);
        }
      }
    } finally {
      // Backtrack: Remove from ancestor chain so DAGs / multiple shared references are permitted
      ancestors.delete(value);
    }
  }
}

/**
 * Type definition for move functions.
 * Moves take ({ G, ctx, events }, ...args) and either mutate G or return a new G.
 */
export type MoveFunction<G = any, C extends Ctx = Ctx> = (
  context: { G: G; ctx: C; events?: any },
  ...args: any[]
) => G | void | any;

/**
 * BaseGame abstract class wrapping boardgame.io Game configuration.
 */
export abstract class BaseGame<G extends any = any, C extends Ctx = Ctx> {
  public abstract readonly name: string;
  public minPlayers: number = 1;
  public maxPlayers: number = 6;

  /**
   * Initializes developer-managed game state (G).
   * Must return a purely JSON-serializable object.
   */
  public abstract setup(ctx: C, setupData?: any): G;

  /**
   * Optional custom validator for G.
   */
  public validate(state: G): void {
    assertJsonSerializable(state);
  }

  /**
   * Defines the move dictionary.
   */
  public moves?: Record<string, any>;

  /**
   * Defines phases (periods that override game rules and turn orders).
   */
  public phases?: Record<string, PhaseConfig<any, any>>;

  /**
   * Defines stages (subdivisions of a turn that apply to individual players).
   */
  public stages?: Record<string, StageConfig<any, any>>;

  /**
   * Optional turn configuration.
   */
  public turn?: any;

  /**
   * Optional game over predicate: (context) => score or result or undefined.
   */
  public endIf?: (context: { G: G; ctx: Ctx }) => any;

  /**
   * Optional player view transformation.
   */
  public playerView?: (context: { G: G; ctx: Ctx; playerID: string | null }) => G;

  /**
   * Exports the configuration into the strict boardgame.io Game object format.
   */
  public toBoardgameConfig(): BoardgameGame<any, any> {
    const wrappedSetup = (setupContext: { ctx: Ctx; [key: string]: any }, setupData?: any): G => {
      const initialG = this.setup(setupContext.ctx as C, setupData);
      this.validate(initialG);
      return initialG;
    };

    const wrapMoves = (moveDict?: Record<string, any>) => {
      if (!moveDict) return undefined;
      const wrapped: Record<string, any> = {};

      for (const [name, moveFn] of Object.entries(moveDict)) {
        if (typeof moveFn === 'function') {
          wrapped[name] = (context: { G: G; ctx: Ctx; events?: any }, ...args: any[]) => {
            const result = moveFn(context, ...args);
            const targetState = result !== undefined ? result : context.G;
            this.validate(targetState);
            return result;
          };
        } else if (moveFn && typeof moveFn === 'object' && typeof moveFn.move === 'function') {
          wrapped[name] = {
            ...moveFn,
            move: (context: { G: G; ctx: Ctx; events?: any }, ...args: any[]) => {
              const result = moveFn.move(context, ...args);
              const targetState = result !== undefined ? result : context.G;
              this.validate(targetState);
              return result;
            }
          };
        } else {
          wrapped[name] = moveFn;
        }
      }
      return wrapped;
    };

    // Wrap phases moves and stages if defined
    const wrappedPhases: Record<string, any> | undefined = this.phases
      ? Object.entries(this.phases).reduce((acc, [phaseName, phaseConfig]) => {
          acc[phaseName] = {
            ...phaseConfig,
            moves: wrapMoves(phaseConfig.moves),
            turn: phaseConfig.turn
              ? {
                  ...phaseConfig.turn,
                  stages: phaseConfig.turn.stages
                    ? Object.entries(phaseConfig.turn.stages).reduce((sAcc, [stageName, stageConfig]) => {
                        sAcc[stageName] = {
                          ...(stageConfig as any),
                          moves: wrapMoves((stageConfig as any).moves)
                        };
                        return sAcc;
                      }, {} as Record<string, any>)
                    : undefined
                }
              : undefined
          };
          return acc;
        }, {} as Record<string, any>)
      : undefined;

    return {
      name: this.name,
      minPlayers: this.minPlayers,
      maxPlayers: this.maxPlayers,
      setup: wrappedSetup as any,
      moves: wrapMoves(this.moves),
      phases: wrappedPhases,
      turn: this.turn,
      endIf: this.endIf ? (context: any) => this.endIf!(context) : undefined,
      playerView: this.playerView ? (context: any) => this.playerView!(context) : undefined
    };
  }
}

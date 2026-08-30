import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StructuredLogger, createLogger, sanitizeLogData } from './Logger';

describe('StructuredLogger & Data Redaction', () => {
  beforeEach(() => {
    StructuredLogger.clearListeners();
    vi.restoreAllMocks();
  });

  it('redacts sensitive fields like credentials, password, and tokens', () => {
    const rawData = {
      matchID: 'match-123',
      playerCredentials: 'super-secret-token',
      password: 'mypassword',
      token: 'bearer-xyz',
      nested: {
        credentials: 'inner-secret',
        playerName: 'Alice'
      }
    };

    const sanitized = sanitizeLogData(rawData);
    expect(sanitized.matchID).toBe('match-123');
    expect(sanitized.playerCredentials).toBe('[REDACTED]');
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.token).toBe('[REDACTED]');
    expect(sanitized.nested.credentials).toBe('[REDACTED]');
    expect(sanitized.nested.playerName).toBe('Alice');
  });

  it('handles circular references gracefully without throwing TypeError', () => {
    const circularObj: any = { name: 'CircularTest' };
    circularObj.self = circularObj;

    const sanitized = sanitizeLogData(circularObj);
    expect(sanitized.name).toBe('CircularTest');
    expect(sanitized.self).toBe('[Circular]');
  });

  it('dispatches structured log events to registered listeners', () => {
    const listener = vi.fn();
    const unsubscribe = StructuredLogger.addListener(listener);

    const logger = createLogger('TestNamespace');
    logger.info('Game match initialized', { matchID: 'm-1', playerID: '0' });

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0];
    expect(event.level).toBe('INFO');
    expect(event.namespace).toBe('TestNamespace');
    expect(event.message).toBe('Game match initialized');
    expect(event.context.matchID).toBe('m-1');

    unsubscribe();
    logger.info('Another message');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('safely silences listener exceptions so log execution never throws', () => {
    StructuredLogger.addListener(() => {
      throw new Error('Listener crash');
    });

    const logger = createLogger('SafeLogger');
    expect(() => {
      logger.error('Failed something', { test: true });
    }).not.toThrow();
  });

  it('throttles high-frequency log messages', () => {
    const listener = vi.fn();
    StructuredLogger.addListener(listener);

    const logger = createLogger('Socket');
    for (let i = 0; i < 5; i++) {
      logger.throttled('socket-reconnect', 1000, 'WARN', 'Reconnecting socket...');
    }

    expect(listener).toHaveBeenCalledTimes(1);
  });
});

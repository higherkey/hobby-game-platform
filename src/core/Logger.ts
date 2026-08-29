export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogContext {
  namespace?: string;
  matchID?: string;
  playerID?: string | null;
  [key: string]: any;
}

export interface LogEvent {
  timestamp: string;
  level: LogLevel;
  namespace: string;
  message: string;
  context?: Record<string, any>;
}

export type LogListener = (event: LogEvent) => void;

const SENSITIVE_KEYS = new Set([
  'credentials',
  'playercredentials',
  'password',
  'secret',
  'adminsecret',
  'token',
  'authorization',
  'database_url',
  'databaseurl'
]);

/**
 * Recursively redacts sensitive keys and protects against circular references
 */
export function sanitizeLogData(obj: any, seen: WeakSet<any> = new WeakSet()): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (seen.has(obj)) {
    return '[Circular]';
  }
  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeLogData(item, seen));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogData(value, seen);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Isomorphic Structured Logger with badge styling and automated redaction
 */
export class StructuredLogger {
  private namespace: string;
  private static listeners: Set<LogListener> = new Set();
  private static throttleTimers: Map<string, number> = new Map();

  constructor(namespace: string = 'App') {
    this.namespace = namespace;
  }

  public static addListener(listener: LogListener): () => void {
    StructuredLogger.listeners.add(listener);
    return () => {
      StructuredLogger.listeners.delete(listener);
    };
  }

  public static clearListeners(): void {
    StructuredLogger.listeners.clear();
  }

  private emit(level: LogLevel, message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    const sanitizedCtx = context ? sanitizeLogData(context) : undefined;
    const event: LogEvent = {
      timestamp,
      level,
      namespace: this.namespace,
      message,
      context: sanitizedCtx
    };

    // Notify registered listeners (e.g. telemetry transmitter)
    for (const listener of StructuredLogger.listeners) {
      try {
        listener(event);
      } catch {
        // Silently discard listener errors to prevent recursion
      }
    }

    // Format for console output
    this.formatConsoleOutput(event);
  }

  private formatConsoleOutput(event: LogEvent): void {
    const isBrowser = typeof window !== 'undefined';
    const tag = `[${event.namespace}]`;
    const details = event.context && Object.keys(event.context).length > 0 ? event.context : '';

    if (isBrowser) {
      const colors: Record<LogLevel, { bg: string; text: string }> = {
        DEBUG: { bg: '#6B7280', text: '#FFFFFF' },
        INFO: { bg: '#2563EB', text: '#FFFFFF' },
        WARN: { bg: '#D97706', text: '#FFFFFF' },
        ERROR: { bg: '#DC2626', text: '#FFFFFF' }
      };
      const { bg, text } = colors[event.level];
      const style = `background: ${bg}; color: ${text}; font-weight: bold; padding: 2px 5px; border-radius: 3px; font-size: 11px;`;

      const fn =
        event.level === 'ERROR'
          ? console.error
          : event.level === 'WARN'
          ? console.warn
          : event.level === 'INFO'
          ? console.info
          : console.log;

      if (details) {
        fn(`%c${tag}%c ${event.message}`, style, 'color: inherit; font-weight: normal;', details);
      } else {
        fn(`%c${tag}%c ${event.message}`, style, 'color: inherit; font-weight: normal;');
      }
    } else {
      const timeStr = event.timestamp.slice(11, 19);
      const prefix = `[${timeStr}] [${event.level}] ${tag} ${event.message}`;
      if (event.level === 'ERROR') {
        console.error(prefix, details ? JSON.stringify(details) : '');
      } else if (event.level === 'WARN') {
        console.warn(prefix, details ? JSON.stringify(details) : '');
      } else {
        console.log(prefix, details ? JSON.stringify(details) : '');
      }
    }
  }

  public debug(message: string, context?: LogContext): void {
    this.emit('DEBUG', message, context);
  }

  public info(message: string, context?: LogContext): void {
    this.emit('INFO', message, context);
  }

  public warn(message: string, context?: LogContext): void {
    this.emit('WARN', message, context);
  }

  public error(message: string, context?: LogContext): void {
    this.emit('ERROR', message, context);
  }

  /**
   * Log with throttling to prevent log flooding on high-frequency events
   */
  public throttled(key: string, intervalMs: number, level: LogLevel, message: string, context?: LogContext): void {
    const now = Date.now();
    const last = StructuredLogger.throttleTimers.get(key) || 0;
    if (now - last >= intervalMs) {
      StructuredLogger.throttleTimers.set(key, now);
      this.emit(level, message, context);
    }
  }
}

export const createLogger = (namespace: string) => new StructuredLogger(namespace);

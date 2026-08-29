import koaBody from 'koa-body';
import { sanitizeLogData, type LogEvent } from '../core/Logger';

const MAX_BUFFER_SIZE = 100;
const MAX_MESSAGE_LENGTH = 1000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;

export const serverAuditBuffer: LogEvent[] = [];
export const clientTelemetryBuffer: LogEvent[] = [];

const ipRateLimits = new Map<string, { count: number; resetAt: number }>();

export function recordServerLog(
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
  namespace: string,
  message: string,
  context?: Record<string, any>
): void {
  const event: LogEvent = {
    timestamp: new Date().toISOString(),
    level,
    namespace,
    message: message.slice(0, MAX_MESSAGE_LENGTH),
    context: context ? sanitizeLogData(context) : undefined
  };

  if (serverAuditBuffer.length >= MAX_BUFFER_SIZE) {
    serverAuditBuffer.shift();
  }
  serverAuditBuffer.push(event);
}

export function clearLogBuffers(): void {
  serverAuditBuffer.length = 0;
  clientTelemetryBuffer.length = 0;
  ipRateLimits.clear();
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipRateLimits.get(ip);

  if (!entry || now > entry.resetAt) {
    ipRateLimits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  entry.count += 1;
  return true;
}

export function registerTelemetryRoutes(router: any, adminSecret?: string): void {
  const expectedSecret = adminSecret || process.env.ADMIN_SECRET || 'dev-admin-secret';

  // Ingest client telemetry (errors/warnings)
  router.post('/api/telemetry', koaBody({ jsonLimit: '10kb' }), async (ctx: any) => {
    const clientIp = ctx.ip || 'unknown';
    if (!checkRateLimit(clientIp)) {
      ctx.status = 429;
      ctx.body = { error: 'Rate limit exceeded' };
      return;
    }

    const body = ctx.request.body;
    if (!body || typeof body.message !== 'string') {
      ctx.status = 400;
      ctx.body = { error: 'Message is required' };
      return;
    }

    // Sanitize message: strip control codes and cap length
    const cleanMessage = body.message
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
      .trim()
      .slice(0, MAX_MESSAGE_LENGTH);

    const validLevels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const level = validLevels.includes(body.level) ? body.level : 'INFO';
    const namespace = typeof body.namespace === 'string' ? body.namespace.slice(0, 50) : 'Client';

    const event: LogEvent = {
      timestamp: typeof body.timestamp === 'string' ? body.timestamp : new Date().toISOString(),
      level,
      namespace,
      message: cleanMessage,
      context: body.context && typeof body.context === 'object' ? sanitizeLogData(body.context) : undefined
    };

    if (clientTelemetryBuffer.length >= MAX_BUFFER_SIZE) {
      clientTelemetryBuffer.shift();
    }
    clientTelemetryBuffer.push(event);

    ctx.status = 204;
  });

  // Admin Logs Query API
  router.get('/api/admin/logs', async (ctx: any) => {
    const authHeader = ctx.headers.authorization;
    const tokenHeader = ctx.headers['x-admin-token'];
    let token = '';

    if (typeof tokenHeader === 'string') {
      token = tokenHeader;
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }

    if (!token || token !== expectedSecret) {
      ctx.status = 401;
      ctx.body = { error: 'Unauthorized: Invalid admin secret token' };
      return;
    }

    ctx.status = 200;
    ctx.body = {
      serverLogs: serverAuditBuffer,
      clientLogs: clientTelemetryBuffer,
      totalCount: serverAuditBuffer.length + clientTelemetryBuffer.length
    };
  });
}

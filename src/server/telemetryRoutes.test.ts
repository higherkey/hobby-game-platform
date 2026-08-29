import { describe, it, expect, beforeEach } from 'vitest';
import Router from '@koa/router';
import {
  registerTelemetryRoutes,
  serverAuditBuffer,
  clientTelemetryBuffer,
  recordServerLog,
  clearLogBuffers
} from './telemetryRoutes';

describe('Telemetry & Admin Log Routes', () => {
  let router: Router;
  const adminSecret = 'test-secret';

  beforeEach(() => {
    clearLogBuffers();
    router = new Router();
    registerTelemetryRoutes(router, adminSecret);
  });

  it('records internal server logs into the isolated audit buffer', () => {
    recordServerLog('INFO', 'Server', 'Match created', { matchID: 'm-123' });
    expect(serverAuditBuffer.length).toBe(1);
    expect(serverAuditBuffer[0].message).toBe('Match created');
    expect(serverAuditBuffer[0].context?.matchID).toBe('m-123');
  });

  it('ingests client telemetry and redacts sensitive data', async () => {
    const route = router.stack.find((r) => r.path === '/api/telemetry' && r.methods.includes('POST'));
    expect(route).toBeDefined();

    const ctx: any = {
      ip: '127.0.0.1',
      request: {
        body: {
          level: 'ERROR',
          namespace: 'Socket',
          message: 'WebSocket sync failed',
          context: {
            playerCredentials: 'my-secret-cred',
            matchID: 'm-999'
          }
        }
      },
      status: 200,
      body: null
    };

    await route!.stack[1](ctx, async () => {});
    expect(ctx.status).toBe(204);
    expect(clientTelemetryBuffer.length).toBe(1);
    expect(clientTelemetryBuffer[0].message).toBe('WebSocket sync failed');
    expect(clientTelemetryBuffer[0].context?.playerCredentials).toBe('[REDACTED]');
    expect(clientTelemetryBuffer[0].context?.matchID).toBe('m-999');
  });

  it('protects /api/admin/logs with admin token authentication', async () => {
    const route = router.stack.find((r) => r.path === '/api/admin/logs' && r.methods.includes('GET'));
    expect(route).toBeDefined();

    // 1. Unauthorized request
    const unauthorizedCtx: any = {
      headers: {},
      status: 200,
      body: null
    };
    await route!.stack[0](unauthorizedCtx, async () => {});
    expect(unauthorizedCtx.status).toBe(401);

    // 2. Authorized request
    recordServerLog('INFO', 'Server', 'Boot complete');
    const authorizedCtx: any = {
      headers: { 'x-admin-token': 'test-secret' },
      status: 200,
      body: null
    };
    await route!.stack[0](authorizedCtx, async () => {});
    expect(authorizedCtx.status).toBe(200);
    expect(authorizedCtx.body.serverLogs.length).toBe(1);
  });
});

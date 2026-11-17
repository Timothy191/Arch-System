/**
 * @swagger
 * /api/health/vibemon:
 *   get:
 *     summary: VibeMon Multi-Agent Telemetry & MCP health check
 *     description: Probes VibeMon remote MCP and local telemetry sink status. VibeMon is an optional developer/agent telemetry service; always returns HTTP 200 so portal availability probes remain unaffected.
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: VibeMon health status
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { type VibemonHealthResponse, vibemonHealthResponseSchema } from '@repo/contract';
import { checkVibemonHealth, DEFAULT_VIBEMON_VERSION } from '@repo/utils/vibemon';
import { type NextRequest, NextResponse } from 'next/server';

const HEALTH_TIMEOUT_MS = 2500;
const HTTP_STATUS_OK = 200;

interface LocalVibemonDiskState {
  readonly diskApiKey?: string;
  readonly version: string;
  readonly localLedgerEvents: number;
}

function readTrimmedFile(targetPath: string): string | undefined {
  try {
    if (!fs.existsSync(/*turbopackIgnore: true*/ targetPath)) {
      return undefined;
    }
    const content = fs.readFileSync(/*turbopackIgnore: true*/ targetPath, 'utf-8').trim();
    return content.length > 0 ? content : undefined;
  } catch {
    return undefined;
  }
}

function countJsonlEvents(eventsFilePath: string): number {
  try {
    if (!fs.existsSync(/*turbopackIgnore: true*/ eventsFilePath)) {
      return 0;
    }
    const content = fs.readFileSync(/*turbopackIgnore: true*/ eventsFilePath, 'utf-8');
    return content.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
  } catch {
    return 0;
  }
}

function inspectLocalVibemonDiskState(): LocalVibemonDiskState {
  const homeVibemonDir = path.join(os.homedir(), '.vibemon');
  const cwdEventsPath = path.join(process.cwd(), '.vibemon', 'events.jsonl');
  const rootEventsPath = path.resolve(process.cwd(), '..', '..', '.vibemon', 'events.jsonl');
  const resolvedEventsCount = countJsonlEvents(cwdEventsPath) || countJsonlEvents(rootEventsPath);

  return {
    diskApiKey: readTrimmedFile(path.join(homeVibemonDir, 'api-key')),
    version: readTrimmedFile(path.join(homeVibemonDir, 'version')) ?? DEFAULT_VIBEMON_VERSION,
    localLedgerEvents: resolvedEventsCount,
  };
}

export async function GET(_request: NextRequest) {
  const diskState = inspectLocalVibemonDiskState();
  const effectiveApiKey = process.env.VIBEMON_API_KEY?.trim() || diskState.diskApiKey;

  const healthResult = await checkVibemonHealth({
    apiKey: effectiveApiKey,
    teamId: process.env.VIBEMON_TEAM_ID,
    version: diskState.version,
    localLedgerEvents: diskState.localLedgerEvents,
    timeoutMs: HEALTH_TIMEOUT_MS,
  });

  const candidatePayload: VibemonHealthResponse = {
    status: healthResult.status,
    optional: true,
    configured: healthResult.isConfigured,
    keyMode: healthResult.keyMode,
    backendStatus: 'normal',
    latencyMs: healthResult.latencyMs,
    lastCheck: new Date().toISOString(),
    details: {
      mcpUrl: healthResult.mcpUrl,
      hookUrl: healthResult.hookUrl,
      version: healthResult.version,
      httpStatus: healthResult.httpStatus,
      localLedgerEvents: healthResult.localLedgerEvents,
      activeTeamId: healthResult.activeTeamId,
      openTodosCount: healthResult.openTodosCount,
      activeSessionsCount: healthResult.activeSessionsCount,
      error: healthResult.error,
    },
  };

  const parsedPayload = vibemonHealthResponseSchema.safeParse(candidatePayload);
  const responseBody = parsedPayload.success ? parsedPayload.data : candidatePayload;

  return NextResponse.json(responseBody, {
    status: HTTP_STATUS_OK,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  });
}

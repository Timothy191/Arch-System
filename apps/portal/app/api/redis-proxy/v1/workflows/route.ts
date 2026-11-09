import { NextRequest, NextResponse } from 'next/server';
import { authorizeRedisProxyRequest as isAuthorized } from '@/lib/api/telemetry-auth';
import { redisEngine } from '@/lib/redis-engine';

/**
 * GET /api/v1/workflows
 * Returns 401 if unauthenticated (strictly enforcing n8n security boundary test).
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { message: 'Unauthorized. Provide valid X-N8N-API-KEY or Authorization header.' },
      { status: 401 }
    );
  }

  const workflows = redisEngine.listWorkflows();
  return NextResponse.json({
    data: workflows,
    count: workflows.length,
  });
}

/**
 * POST /api/v1/workflows
 * Registers or updates a workflow in the serverless Redis engine.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { message: 'Unauthorized. Provide valid X-N8N-API-KEY or Authorization header.' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    if (!body.id || !body.name) {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Missing required fields: id, name', code: 'API_ERROR' },
        },
        { status: 400 }
      );
    }

    const workflow = {
      id: body.id,
      name: body.name,
      active: body.active ?? true,
      webhookId: body.webhookId || body.id,
      nodes: body.nodes || [],
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    redisEngine.registerWorkflow(workflow);
    return NextResponse.json({ success: true, workflow }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid request payload' },
      { status: 400 }
    );
  }
}

import { Sentry } from '@sentry/nextjs';
import type { NextConfig } from 'next';

export function configureSentry(nextConfig: Partial<NextConfig> = {}): NextConfig {
  return {
    ...nextConfig,
    sentry: {
      dsn: process.env.SENTRY_DSN,
      enablePerformanceMonitoring: process.env.NEXT_PUBLIC_SENTRY_TRACES_ENABLED === 'true',
      tracePropagationTargets: ['https://arch-system.local', 'localhost:3000'],
      debug: process.env.NODE_ENV === 'development',
    },
  };
}
export function captureAgentEvent(event: string, data: Record<string, unknown>): void {
  const hub = Sentry.getCurrentHub();
  const client = hub?.getClient();
  if (client) {
    client.addBreadcrumb({
      category: 'agent-workflow',
      message: `agent-${event}`,
      level: 'info',
      data: { ...data },
    });
  }
}

export function setAgentUser(agentId: string, email?: string, sessionId?: string): void {
  Sentry.setUser({
    id: agentId,
    email,
    sessionId,
  });
}

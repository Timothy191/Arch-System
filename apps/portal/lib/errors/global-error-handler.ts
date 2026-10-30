/**
 * Global Error Handler with Autonomous Recovery
 *
 * Sets up global listeners for unhandled rejections and uncaught errors,
 * integrates with circuit breaker for failure tracking, and provides
 * optional Sentry reporting for production monitoring.
 */

import { getAllCircuitBreakerStats, getCircuitBreaker } from './circuit-breaker';
import { isAppError } from './error-classes';

export interface GlobalErrorHandlerOptions {
  /** Whether to report errors to external service (Sentry, etc.) in production. */
  reportErrors?: boolean;
  /** Custom error handler callback. */
  onError?: (error: Error, info: ErrorHandlerInfo) => void;
  /** Environment check for development vs production. */
  isProduction?: boolean;
}

export interface ErrorHandlerInfo {
  /** Type of error event. */
  type: 'unhandledrejection' | 'error' | 'circuit-open' | 'circuit-recovered';
  /** The original error. */
  error: Error;
  /** Timestamp of when the error was handled. */
  timestamp: Date;
  /** Additional context about the error. */
  context?: Record<string, unknown>;
}

/**
 * Default handler for global errors.
 */
function defaultErrorHandler(error: Error, info: ErrorHandlerInfo): void {
  if (process.env.NODE_ENV === 'development') {
    console.error(`[GlobalErrorHandler] ${info.type}:`, error, info.context);
  }
}

/**
 * Get circuit breaker stats for context.
 */
function getCircuitContext(): Record<string, unknown> {
  const stats = getAllCircuitBreakerStats();
  if (stats.length === 0) return {};
  return {
    circuitBreakers: stats.map((s) => ({
      name: s.name,
      state: s.state,
      failureCount: s.failureCount,
      context: s.context,
    })),
  };
}

/**
 * Report error to external monitoring service if available.
 */
function reportToMonitoring(error: Error, info: ErrorHandlerInfo): void {
  if (typeof window === 'undefined') return;

  // Sentry integration
  const sentry = (
    window as unknown as { Sentry?: { captureException: (err: unknown, ctx: unknown) => void } }
  ).Sentry;
  if (sentry) {
    try {
      sentry.captureException(error, {
        contexts: {
          globalErrorHandler: {
            type: info.type,
            timestamp: info.timestamp.toISOString(),
            ...info.context,
            ...getCircuitContext(),
          },
        },
        tags: {
          error_handler: 'global',
          type: info.type,
        },
      });
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[GlobalErrorHandler] Failed to report to Sentry:', e);
      }
    }
  }

  // Custom monitoring endpoint (if configured)
  const monitoringEndpoint = process.env.NEXT_PUBLIC_MONITORING_ENDPOINT;
  if (monitoringEndpoint) {
    fetch(monitoringEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        type: info.type,
        timestamp: info.timestamp.toISOString(),
        context: info.context,
        circuits: getCircuitContext(),
      }),
      keepalive: true,
    }).catch(() => {
      // Silently fail - monitoring should never block the app
    });
  }
}

/**
 * Handle unhandled promise rejections.
 */
function handleUnhandledRejection(
  event: PromiseRejectionEvent,
  options: Required<GlobalErrorHandlerOptions>
): void {
  const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));

  // Prevent default browser behavior
  event.preventDefault();

  const info: ErrorHandlerInfo = {
    type: 'unhandledrejection',
    error,
    timestamp: new Date(),
    context: {
      reason: event.reason,
      ...getCircuitContext(),
    },
  };

  options.onError(error, info);

  if (options.reportErrors && options.isProduction) {
    reportToMonitoring(error, info);
  }

  // Track in circuit breaker for pattern analysis
  const globalBreaker = getCircuitBreaker('global-unhandled', {
    failureThreshold: 10,
    timeoutMs: 60000,
    context: 'unhandled-rejection',
  });

  globalBreaker
    .call(async () => {
      // Just record the failure pattern
      throw error;
    })
    .catch(() => {
      // Ignore - we're just tracking patterns
    });
}

/**
 * Handle uncaught errors.
 */
function handleUncaughtError(
  event: ErrorEvent,
  options: Required<GlobalErrorHandlerOptions>
): void {
  const error =
    event.error instanceof Error ? event.error : new Error(event.message || 'Unknown error');

  const info: ErrorHandlerInfo = {
    type: 'error',
    error,
    timestamp: new Date(),
    context: {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      ...getCircuitContext(),
    },
  };

  options.onError(error, info);

  if (options.reportErrors && options.isProduction) {
    reportToMonitoring(error, info);
  }

  // Track in circuit breaker for pattern analysis
  const globalBreaker = getCircuitBreaker('global-uncaught', {
    failureThreshold: 10,
    timeoutMs: 60000,
    context: 'uncaught-error',
  });

  globalBreaker
    .call(async () => {
      throw error;
    })
    .catch(() => {
      // Ignore - we're just tracking patterns
    });
}

/**
 * Initialize global error handling.
 *
 * Call this once at application startup (e.g., in ClientProviders).
 *
 * @example
 * ```typescript
 * import { initializeGlobalErrorHandler } from '@/lib/errors/global-error-handler';
 *
 * initializeGlobalErrorHandler({
 *   reportErrors: process.env.NODE_ENV !== 'development',
 *   onError: (error, info) => {
 *     console.error('Global error:', error, info);
 *   },
 * });
 * ```
 */
export function initializeGlobalErrorHandler(options: GlobalErrorHandlerOptions = {}): void {
  // Only initialize once
  if (typeof window === 'undefined') return;

  // Check if already initialized
  if (
    (window as unknown as { __globalErrorHandlerInitialized?: boolean })
      .__globalErrorHandlerInitialized
  ) {
    if (process.env.NODE_ENV === 'development') {
      console.info('[GlobalErrorHandler] Already initialized, skipping');
    }
    return;
  }

  const mergedOptions: Required<GlobalErrorHandlerOptions> = {
    reportErrors: options.reportErrors ?? false,
    onError: options.onError ?? defaultErrorHandler,
    isProduction: options.isProduction ?? process.env.NODE_ENV === 'production',
  };

  // Mark as initialized
  (
    window as unknown as { __globalErrorHandlerInitialized?: boolean }
  ).__globalErrorHandlerInitialized = true;

  // Listen for unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    handleUnhandledRejection(event, mergedOptions);
  });

  // Listen for uncaught errors
  window.addEventListener('error', (event) => {
    handleUncaughtError(event, mergedOptions);
  });

  // Listen for circuit breaker state changes (custom events from circuit-breaker)
  window.addEventListener('circuit-breaker-state-change', ((event: CustomEvent) => {
    const { name, state, failureCount } = event.detail;

    const info: ErrorHandlerInfo = {
      type: state === 'OPEN' ? 'circuit-open' : 'circuit-recovered',
      error: new Error(`Circuit breaker "${name}" transitioned to ${state}`),
      timestamp: new Date(),
      context: {
        circuitName: name,
        state,
        failureCount,
        ...getCircuitContext(),
      },
    };

    mergedOptions.onError(info.error, info);

    if (mergedOptions.reportErrors && mergedOptions.isProduction && state === 'OPEN') {
      reportToMonitoring(info.error, info);
    }
  }) as EventListener);

  if (process.env.NODE_ENV === 'development') {
    console.info('[GlobalErrorHandler] Initialized with options:', {
      reportErrors: mergedOptions.reportErrors,
      isProduction: mergedOptions.isProduction,
    });
  }
}

/**
 * Check if global error handler is initialized.
 */
export function isGlobalErrorHandlerInitialized(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    (window as unknown as { __globalErrorHandlerInitialized?: boolean })
      .__globalErrorHandlerInitialized === true
  );
}

/**
 * Manually report an error to the global handler (for async errors not caught by listeners).
 */
export function reportError(error: Error, context?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;

  const info: ErrorHandlerInfo = {
    type: 'error',
    error,
    timestamp: new Date(),
    context: {
      ...context,
      ...getCircuitContext(),
    },
  };

  const defaultHandler = defaultErrorHandler;
  defaultHandler(error, info);

  if (process.env.NODE_ENV === 'production') {
    reportToMonitoring(error, info);
  }
}

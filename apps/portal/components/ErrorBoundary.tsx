'use client';

import { Button } from '@repo/ui/components/ui/button';
import { GlassCard } from '@repo/ui/GlassCard';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { Component, type ReactNode } from 'react';
import { getCircuitBreaker } from '@/lib/errors/circuit-breaker';
import { isRetryableErrorDefault } from '@/lib/errors/retry-strategy';

// AGENT-TRACE: ErrorBoundary provides graceful degradation with autonomous recovery
// Critical for production stability, especially for external dependencies like FUXA SCADA

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
const RECOVERY_CIRCUIT_TIMEOUT_MS = 15000;

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (_error: Error, _errorInfo: React.ErrorInfo) => void;
  context?: string;
  title?: string;
  message?: string;
  /** Recovery strategy: 'retry', 'fallback', 'none' */
  strategy?: 'retry' | 'fallback' | 'none';
  /** Max retries before showing error UI */
  maxRetries?: number;
  /** Base delay in ms between retries */
  retryDelayMs?: number;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  retryCount: number;
  isRecovering: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private recoveryTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private isUnmounted = false;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRecovering: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidMount() {
    this.isUnmounted = false;
  }

  componentWillUnmount() {
    this.isUnmounted = true;
    if (this.recoveryTimeoutId) {
      clearTimeout(this.recoveryTimeoutId);
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Report to Sentry if available in global scope
    try {
      if (
        typeof window !== 'undefined' &&
        (
          window as unknown as {
            Sentry?: { captureException: (err: unknown, ctx: unknown) => void };
          }
        ).Sentry
      ) {
        (
          window as unknown as {
            Sentry: { captureException: (err: unknown, ctx: unknown) => void };
          }
        ).Sentry.captureException(error, {
          contexts: {
            react: {
              componentStack: errorInfo.componentStack,
              customContext: this.props.context || 'Unknown',
            },
          },
          tags: {
            error_boundary: 'true',
            context: this.props.context || 'unknown',
          },
        });
      }
    } catch (sentryError) {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.warn('Failed to report to Sentry:', sentryError);
      }
    }

    // Autonomous recovery if strategy is configured
    if (this.props.strategy && this.props.strategy !== 'none') {
      this.attemptAutonomousRecovery(error);
    }
  }

  private attemptAutonomousRecovery(error: Error): void {
    const { strategy = 'retry' } = this.props;
    const maxRetries = this.props.maxRetries ?? DEFAULT_MAX_RETRIES;
    const baseDelay = this.props.retryDelayMs ?? DEFAULT_BASE_DELAY_MS;
    const contextKey = this.props.context || 'default';

    if (strategy === 'fallback') {
      const breaker = getCircuitBreaker(contextKey, {
        failureThreshold: maxRetries,
        timeoutMs: RECOVERY_CIRCUIT_TIMEOUT_MS,
      });

      if (breaker.currentState === 'OPEN') {
        // Circuit already open, don't loop recoveries
        return;
      }
    }

    // Check if error is deemed non-retryable
    if (strategy === 'retry' && !isRetryableErrorDefault(error)) {
      return;
    }

    if (this.state.retryCount < maxRetries) {
      const nextAttempt = this.state.retryCount + 1;
      const delayMs = baseDelay * 2 ** (nextAttempt - 1);

      this.setState({
        isRecovering: true,
        retryCount: nextAttempt,
      });

      this.recoveryTimeoutId = setTimeout(() => {
        if (!this.isUnmounted) {
          this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
            isRecovering: false,
          });
        }
      }, delayMs);
    } else {
      this.setState({ isRecovering: false });
    }
  }

  handleReset = () => {
    if (this.recoveryTimeoutId) {
      clearTimeout(this.recoveryTimeoutId);
    }
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRecovering: false,
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback && !this.state.isRecovering) {
        return this.props.fallback;
      }

      const displayTitle = this.props.title || 'Control Room Component Interrupted';
      const displayMessage =
        this.props.message ||
        (this.props.context
          ? `An error occurred in ${this.props.context}. Telemetry recorded message.`
          : 'Telemetry recorded message. Attempting component recovery.');

      // Autonomous recovery spinner card
      if (this.state.isRecovering) {
        return (
          <div className="flex min-h-[400px] items-center justify-center p-4">
            <GlassCard className="w-full max-w-md border-indigo-200 bg-indigo-50/50">
              <div className="space-y-6">
                <div className="flex justify-center">
                  <div className="rounded-full border border-indigo-300 bg-indigo-100 p-4">
                    <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
                  </div>
                </div>

                <div className="space-y-2 text-center">
                  <h3 className="font-medium text-indigo-900 text-lg">
                    {displayTitle} — Recovering
                  </h3>
                  <p className="text-indigo-700 text-sm">
                    Attempting autonomous component recovery...
                  </p>
                  <p className="font-mono text-indigo-500 text-xs">
                    Retry attempt {this.state.retryCount} of{' '}
                    {this.props.maxRetries ?? DEFAULT_MAX_RETRIES}
                  </p>
                </div>
              </div>
            </GlassCard>
          </div>
        );
      }

      // Default fallback UI with rose theme
      return (
        <div className="flex min-h-[400px] items-center justify-center p-4">
          <GlassCard className="w-full max-w-md border-rose-200 bg-rose-50/50">
            <div className="space-y-6">
              {/* Error Icon */}
              <div className="flex justify-center">
                <div className="rounded-full border border-rose-300 bg-rose-100 p-4">
                  <AlertTriangle className="h-8 w-8 text-rose-600" />
                </div>
              </div>

              {/* Error Message */}
              <div className="space-y-2 text-center">
                <h3 className="font-medium text-lg text-rose-900">{displayTitle}</h3>
                <p className="text-rose-700 text-sm">{displayMessage}</p>
                <p className="font-mono text-rose-500 text-xs">
                  {this.state.error?.message || 'Unknown error'}
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={this.handleReset}
                  variant="outline"
                  className="flex-1 border-rose-300 text-rose-900 hover:bg-rose-100"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
                <Button
                  onClick={this.handleGoHome}
                  variant="default"
                  className="flex-1 bg-rose-600 text-white hover:bg-rose-700"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Go Home
                </Button>
              </div>

              {/* Development Info */}
              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-[var(--text-muted)] text-xs hover:text-[var(--text-secondary)]">
                    Error Details (Development Only)
                  </summary>
                  <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-[var(--bg-tertiary)] p-3 text-xs">
                    <code>
                      {this.state.error?.toString()}
                      {'\n\n'}
                      {this.state.errorInfo?.componentStack}
                    </code>
                  </pre>
                </details>
              )}
            </div>
          </GlassCard>
        </div>
      );
    }

    return this.props.children;
  }
}

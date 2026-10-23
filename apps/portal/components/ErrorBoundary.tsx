'use client';

import { Button } from '@repo/ui/components/ui/button';
import { GlassCard } from '@repo/ui/GlassCard';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { Component, type ReactNode } from 'react';

// AGENT-TRACE: ErrorBoundary provides graceful degradation when React components fail
// Critical for production stability, especially for external dependencies like FUXA SCADA

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (_error: Error, _errorInfo: React.ErrorInfo) => void;
  context?: string;
  title?: string;
  message?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // AGENT-TRACE: Report to Sentry with additional context
    try {
      if (typeof window !== 'undefined' && (window as any).Sentry) {
        (window as any).Sentry.captureException(error, {
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
      // eslint-disable-next-line no-console
      console.warn('Failed to report to Sentry:', sentryError);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const displayTitle = this.props.title || 'Control Room Component Interrupted';
      const displayMessage =
        this.props.message ||
        (this.props.context
          ? `An error occurred in ${this.props.context}. Telemetry recorded message.`
          : 'Telemetry recorded message. Attempting component recovery.');

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

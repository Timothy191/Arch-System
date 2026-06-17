"use client";

import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { GlassCard } from "@repo/ui/GlassCard";

// AGENT-TRACE: ErrorBoundary provides graceful degradation when React components fail
// Critical for production stability, especially for external dependencies like FUXA SCADA

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (_error: Error, _errorInfo: React.ErrorInfo) => void;
  context?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
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
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // AGENT-TRACE: Report to Sentry with additional context
    // Sentry integration is configured in instrumentation.ts
    // Additional context includes component stack and custom context prop
    try {
      if (typeof window !== "undefined" && (window as any).Sentry) {
        (window as any).Sentry.captureException(error, {
          contexts: {
            react: {
              componentStack: errorInfo.componentStack,
              customContext: this.props.context || "Unknown",
            },
          },
          tags: {
            error_boundary: "true",
            context: this.props.context || "unknown",
          },
        });
      }
    } catch (sentryError) {
      // eslint-disable-next-line no-console
      console.warn("Failed to report to Sentry:", sentryError);
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
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <GlassCard className="max-w-md w-full">
            <div className="space-y-6">
              {/* Error Icon */}
              <div className="flex justify-center">
                <div className="p-4 rounded-full bg-accent-red/10 border border-accent-red/20">
                  <AlertTriangle className="w-8 h-8 text-accent-red" />
                </div>
              </div>

              {/* Error Message */}
              <div className="text-center space-y-2">
                <h3 className="text-lg font-medium text-[var(--text-heading)]">
                  Something went wrong
                </h3>
                <p className="text-[var(--text-secondary)] text-sm">
                  {this.props.context
                    ? `An error occurred in ${this.props.context}.`
                    : "An unexpected error occurred."}
                </p>
                <p className="text-[var(--text-muted)] text-xs">
                  {this.state.error?.message || "Unknown error"}
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={this.handleReset}
                  variant="outline"
                  className="flex-1"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button
                  onClick={this.handleGoHome}
                  variant="default"
                  className="flex-1"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Go Home
                </Button>
              </div>

              {/* Development Info */}
              {process.env.NODE_ENV === "development" &&
                this.state.errorInfo && (
                  <details className="mt-4">
                    <summary className="text-xs text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-secondary)]">
                      Error Details (Development Only)
                    </summary>
                    <pre className="mt-2 p-3 bg-[var(--bg-tertiary)] rounded-lg text-xs overflow-auto max-h-48">
                      <code>
                        {this.state.error?.toString()}
                        {"\n\n"}
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

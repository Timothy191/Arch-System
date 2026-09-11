"use client";

import { Button } from "@repo/ui/components/ui/button";
import { GlassCard } from "@repo/ui/GlassCard";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Component, type ReactNode } from "react";

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
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // AGENT-TRACE: Report to Sentry with additional context
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

      const displayTitle = this.props.title || "Control Room Component Interrupted";
      const displayMessage =
        this.props.message ||
        (this.props.context
          ? `An error occurred in ${this.props.context}. Telemetry recorded message.`
          : "Telemetry recorded message. Attempting component recovery.");

      // Default fallback UI with rose theme
      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <GlassCard className="max-w-md w-full border-rose-200 bg-rose-50/50">
            <div className="space-y-6">
              {/* Error Icon */}
              <div className="flex justify-center">
                <div className="p-4 rounded-full bg-rose-100 border border-rose-300">
                  <AlertTriangle className="w-8 h-8 text-rose-600" />
                </div>
              </div>

              {/* Error Message */}
              <div className="text-center space-y-2">
                <h3 className="text-lg font-medium text-rose-900">
                  {displayTitle}
                </h3>
                <p className="text-rose-700 text-sm">
                  {displayMessage}
                </p>
                <p className="text-rose-500 text-xs font-mono">
                  {this.state.error?.message || "Unknown error"}
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={this.handleReset} variant="outline" className="flex-1 border-rose-300 text-rose-900 hover:bg-rose-100">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button onClick={this.handleGoHome} variant="default" className="flex-1 bg-rose-600 hover:bg-rose-700 text-white">
                  <Home className="w-4 h-4 mr-2" />
                  Go Home
                </Button>
              </div>

              {/* Development Info */}
              {process.env.NODE_ENV === "development" && this.state.errorInfo && (
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

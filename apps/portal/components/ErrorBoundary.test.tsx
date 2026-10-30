import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { NetworkError } from '@/lib/errors/error-classes';
import { ErrorBoundary } from './ErrorBoundary';

// Mock child component that throws on demand
const ProblemChild = ({
  shouldThrow,
  message = 'Test error',
}: {
  shouldThrow: boolean;
  message?: string;
}) => {
  if (shouldThrow) {
    throw new NetworkError(message);
  }
  return <div>Child Content Normal</div>;
};

describe('ErrorBoundary', () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    // Suppress React error boundary warnings in test output
    console.error = jest.fn();
    jest.clearAllMocks();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('renders children without error when no throw occurs', () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Child Content Normal')).toBeInTheDocument();
  });

  it('displays default rose error card when an unhandled error is thrown', () => {
    render(
      <ErrorBoundary title="Telemetry Error" message="SCADA system failure" strategy="none">
        <ProblemChild shouldThrow={true} message="Connection refused" />
      </ErrorBoundary>
    );

    expect(screen.getByText('Telemetry Error')).toBeInTheDocument();
    expect(screen.getByText('SCADA system failure')).toBeInTheDocument();
    expect(screen.getByText('Connection refused')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go home/i })).toBeInTheDocument();
  });

  it('triggers autonomous recovery state when strategy is retry and error is retryable', () => {
    render(
      <ErrorBoundary title="Network Drop" strategy="retry" maxRetries={2} retryDelayMs={500}>
        <ProblemChild shouldThrow={true} message="Network connection lost" />
      </ErrorBoundary>
    );

    // Shows recovering UI
    expect(screen.getByText(/Network Drop — Recovering/i)).toBeInTheDocument();
    expect(screen.getByText(/Retry attempt 1 of 2/i)).toBeInTheDocument();
  });

  it('renders custom fallback when provided and not recovering', () => {
    render(
      <ErrorBoundary fallback={<div>Custom Error View</div>} strategy="none">
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom Error View')).toBeInTheDocument();
  });
});

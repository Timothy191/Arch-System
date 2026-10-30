import { CircuitBreaker, getCircuitBreaker, resetAllCircuitBreakers } from './circuit-breaker';

describe('CircuitBreaker', () => {
  beforeEach(() => {
    resetAllCircuitBreakers();
    jest.clearAllMocks();
  });

  describe('state transitions', () => {
    it('starts in CLOSED state and allows requests through', async () => {
      const breaker = new CircuitBreaker('test-service', { failureThreshold: 3 });

      expect(breaker.currentState).toBe('CLOSED');
      expect(breaker.isClosed).toBe(true);
      expect(breaker.isForcedOpen).toBe(false);

      const result = await breaker.call(async () => 'success-data');
      expect(result).toBe('success-data');
      expect(breaker.currentState).toBe('CLOSED');
      expect(breaker.currentFailures).toBe(0);
    });

    it('transitions from CLOSED to OPEN after reaching failureThreshold', async () => {
      const breaker = new CircuitBreaker('failing-service', {
        failureThreshold: 3,
        timeoutMs: 1000,
        logErrors: false,
      });

      const failingOp = async () => {
        throw new Error('Service down');
      };

      // 1st failure
      await expect(breaker.call(failingOp)).rejects.toThrow('Service down');
      expect(breaker.currentState).toBe('CLOSED');
      expect(breaker.currentFailures).toBe(1);

      // 2nd failure
      await expect(breaker.call(failingOp)).rejects.toThrow('Service down');
      expect(breaker.currentState).toBe('CLOSED');
      expect(breaker.currentFailures).toBe(2);

      // 3rd failure trips the breaker
      await expect(breaker.call(failingOp)).rejects.toThrow('Service down');
      expect(breaker.currentState).toBe('OPEN');
      expect(breaker.isClosed).toBe(false);
      expect(breaker.isForcedOpen).toBe(true);

      // Subsequent call fails fast with CIRCUIT_OPEN error
      await expect(breaker.call(failingOp)).rejects.toThrow(
        'Circuit breaker "failing-service" is OPEN — service unavailable'
      );
    });

    it('transitions to HALF_OPEN after timeout elapses and allows trial request', async () => {
      jest.useFakeTimers();

      const breaker = new CircuitBreaker('half-open-service', {
        failureThreshold: 2,
        timeoutMs: 5000,
        logErrors: false,
      });

      const failingOp = async () => {
        throw new Error('Network timeout');
      };

      await expect(breaker.call(failingOp)).rejects.toThrow('Network timeout');
      await expect(breaker.call(failingOp)).rejects.toThrow('Network timeout');
      expect(breaker.currentState).toBe('OPEN');

      // Fast-forward time past timeoutMs
      jest.advanceTimersByTime(5001);

      // Next successful trial call recovers the breaker to CLOSED
      const trialSuccess = async () => 'recovered';
      const result = await breaker.call(trialSuccess);

      expect(result).toBe('recovered');
      expect(breaker.currentState).toBe('CLOSED');
      expect(breaker.currentFailures).toBe(0);

      jest.useRealTimers();
    });

    it('re-opens if trial request fails in HALF_OPEN state', async () => {
      jest.useFakeTimers();

      const breaker = new CircuitBreaker('flaky-service', {
        failureThreshold: 1,
        timeoutMs: 3000,
        logErrors: false,
      });

      await expect(
        breaker.call(async () => {
          throw new Error('Error 1');
        })
      ).rejects.toThrow('Error 1');
      expect(breaker.currentState).toBe('OPEN');

      // Fast-forward
      jest.advanceTimersByTime(3001);

      // Trial request fails
      await expect(
        breaker.call(async () => {
          throw new Error('Trial failed');
        })
      ).rejects.toThrow('Trial failed');

      expect(breaker.currentState).toBe('OPEN');

      jest.useRealTimers();
    });
  });

  describe('fallbacks', () => {
    it('executes configured fallback when circuit is OPEN', async () => {
      const fallbackMock = jest.fn().mockResolvedValue('fallback-value');
      const breaker = new CircuitBreaker('fallback-service', {
        failureThreshold: 1,
        timeoutMs: 10000,
        fallback: fallbackMock,
        logErrors: false,
      });

      // Cause open
      const resultOnTrip = await breaker.call(async () => {
        throw new Error('Immediate drop');
      });
      expect(resultOnTrip).toBe('fallback-value');
      expect(breaker.currentState).toBe('OPEN');

      // Next call uses fallback directly without executing op
      const opMock = jest.fn().mockResolvedValue('never-called');
      const fallbackResult = await breaker.call(opMock);

      expect(fallbackResult).toBe('fallback-value');
      expect(opMock).not.toHaveBeenCalled();
      expect(fallbackMock).toHaveBeenCalledTimes(2);
    });

    it('supports callWithFallback to provide per-invocation fallback', async () => {
      const breaker = new CircuitBreaker('per-call-service', {
        failureThreshold: 1,
        timeoutMs: 10000,
        logErrors: false,
      });

      // Trip breaker
      await expect(
        breaker.call(async () => {
          throw new Error('Trip');
        })
      ).rejects.toThrow('Trip');
      expect(breaker.currentState).toBe('OPEN');

      // Execute with per-call fallback
      const result = await breaker.callWithFallback(
        async () => 'real-data',
        () => 'custom-fallback'
      );

      expect(result).toBe('custom-fallback');
    });
  });

  describe('statistics and registry', () => {
    it('tracks accurate stats and resets properly', async () => {
      const breaker = new CircuitBreaker('metrics-service', {
        failureThreshold: 5,
        context: 'telemetry',
      });
      await breaker.call(async () => 'ok');

      let stats = breaker.getStats();
      expect(stats.name).toBe('metrics-service');
      expect(stats.context).toBe('telemetry');
      expect(stats.state).toBe('CLOSED');
      expect(stats.successCount).toBe(0);

      breaker.reset();
      stats = breaker.getStats();
      expect(stats.state).toBe('CLOSED');
      expect(stats.failureCount).toBe(0);
    });

    it('manages singleton breakers in registry', () => {
      const b1 = getCircuitBreaker('shared-supabase');
      const b2 = getCircuitBreaker('shared-supabase');
      expect(b1).toBe(b2);
    });
  });
});

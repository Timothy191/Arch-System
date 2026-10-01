import { useRedisCache, useWorkflowTrigger } from '@repo/shared/hooks';
import { act, renderHook } from '@testing-library/react';

describe('Industrial Hooks: useRedisCache & useWorkflowTrigger', () => {
  describe('useRedisCache', () => {
    it('initializes with initialData when provided', () => {
      const { result } = renderHook(() =>
        useRedisCache('test:key', async () => 'fresh-data', {
          initialData: 'initial-data',
          enabled: false,
        })
      );

      expect(result.current.data).toBe('initial-data');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isError).toBe(false);
    });

    it('mutates local cache optimistically', async () => {
      const { result } = renderHook(() =>
        useRedisCache('test:mutate', async () => 'server-value', {
          initialData: 'initial-value',
          enabled: false,
        })
      );

      await act(async () => {
        await result.current.mutate('optimistic-value');
      });

      expect(result.current.data).toBe('optimistic-value');
    });
  });

  describe('useWorkflowTrigger', () => {
    it('initializes in idle state', () => {
      const { result } = renderHook(() => useWorkflowTrigger());

      expect(result.current.isTriggering).toBe(false);
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.isError).toBe(false);
      expect(result.current.lastExecutionId).toBeNull();
    });

    it('handles successful workflow dispatch or fallback safely', async () => {
      const mockSuccess = jest.fn();
      const { result } = renderHook(() =>
        useWorkflowTrigger({
          onSuccess: mockSuccess,
          fallback: async () => ({ status: 'fallback_ok' }),
        })
      );

      let response: any;
      await act(async () => {
        response = await result.current.trigger('test-webhook', { event: 'unit_test' });
      });

      expect(response).toBeDefined();
      expect(result.current.isTriggering).toBe(false);
    });
  });
});

"use client";

import { useOptimistic, useState, useTransition } from "react";

export interface ActionResult<TData = unknown> {
  success: boolean;
  data?: TData;
  error?: string;
}

export interface UseOptimisticActionOptions<TState, TInput, TData = unknown> {
  /** Initial or current server-rendered state */
  currentState: TState;
  /** Reducer function that updates state optimistically based on action input */
  updateFn: (state: TState, input: TInput) => TState;
  /** Server Action or async function that persists the mutation */
  action: (input: TInput) => Promise<ActionResult<TData>>;
  /** Optional callback fired when the action succeeds */
  onSuccess?: (data?: TData) => void;
  /** Optional callback fired when the action fails or errors */
  onError?: (error: string) => void;
}

/**
 * useOptimisticAction
 *
 * Combines React 19 useOptimistic + useTransition with Server Actions.
 * Provides immediate UI feedback, automatic error rollback, and loading state.
 */
export function useOptimisticAction<TState, TInput, TData = unknown>({
  currentState,
  updateFn,
  action,
  onSuccess,
  onError,
}: UseOptimisticActionOptions<TState, TInput, TData>) {
  const [isPending, startTransition] = useTransition();
  const [lastError, setLastError] = useState<string | null>(null);

  const [optimisticState, setOptimisticState] = useOptimistic(
    currentState,
    updateFn,
  );

  const execute = (input: TInput) => {
    setLastError(null);

    startTransition(async () => {
      // Apply optimistic update immediately
      setOptimisticState(input);

      try {
        const result = await action(input);

        if (!result.success) {
          const errMsg = result.error || "Action failed";
          setLastError(errMsg);
          onError?.(errMsg);
          return;
        }

        onSuccess?.(result.data);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Unexpected server error";
        setLastError(errMsg);
        onError?.(errMsg);
      }
    });
  };

  return {
    state: optimisticState,
    execute,
    isPending,
    error: lastError,
  };
}

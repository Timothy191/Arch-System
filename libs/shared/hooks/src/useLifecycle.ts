"use client";

import { useEffect, useRef, type DependencyList, type EffectCallback } from "react";

/**
 * Hook executing callback exclusively on component initial mount.
 */
export function useMount(fn: () => void): void {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    fnRef.current();
  }, []);
}

/**
 * Hook executing cleanup callback when component unmounts.
 */
export function useUnmount(fn: () => void): void {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    return () => {
      fnRef.current();
    };
  }, []);
}

/**
 * Hook executing effect on subsequent updates only, bypassing initial mount.
 */
export function useUpdateEffect(effect: EffectCallback, deps?: DependencyList): void {
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    return effect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

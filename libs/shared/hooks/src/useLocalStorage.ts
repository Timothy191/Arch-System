"use client";

import { useSyncExternalStore, useCallback } from "react";
import type { StorageOptions } from "./types";

function getStorageValue<T>(
  storage: Storage | null,
  key: string,
  initialValue: T,
  options?: StorageOptions<T>
): T {
  if (!storage) return initialValue;
  try {
    const raw = storage.getItem(key);
    if (raw === null) return initialValue;
    return options?.deserializer ? options.deserializer(raw) : JSON.parse(raw);
  } catch (error) {
    options?.onError?.(error);
    return initialValue;
  }
}

function createStorageHook(getStorage: () => Storage | null) {
  return function useStorage<T>(
    key: string,
    initialValue: T,
    options?: StorageOptions<T>
  ): [T, (value: T | ((prev: T) => T)) => void, () => void] {
    const subscribe = useCallback(
      (onChange: () => void) => {
        const handleStorageEvent = (event: StorageEvent) => {
          if (event.key === key) {
            onChange();
          }
        };
        window.addEventListener("storage", handleStorageEvent);
        return () => window.removeEventListener("storage", handleStorageEvent);
      },
      [key]
    );

    const getSnapshot = useCallback(
      () => getStorageValue(getStorage(), key, initialValue, options),
      [key, initialValue, options]
    );

    const getServerSnapshot = useCallback(() => initialValue, [initialValue]);

    const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    const setValue = useCallback(
      (val: T | ((prev: T) => T)) => {
        try {
          const storage = getStorage();
          if (!storage) return;

          const current = getStorageValue(storage, key, initialValue, options);
          const nextValue = typeof val === "function" ? (val as (prev: T) => T)(current) : val;

          const serialized = options?.serializer
            ? options.serializer(nextValue)
            : JSON.stringify(nextValue);

          storage.setItem(key, serialized);
          window.dispatchEvent(new StorageEvent("storage", { key }));
        } catch (error) {
          options?.onError?.(error);
        }
      },
      [key, initialValue, options]
    );

    const removeValue = useCallback(() => {
      try {
        const storage = getStorage();
        if (!storage) return;
        storage.removeItem(key);
        window.dispatchEvent(new StorageEvent("storage", { key }));
      } catch (error) {
        options?.onError?.(error);
      }
    }, [key, options]);

    return [value, setValue, removeValue];
  };
}

export const useLocalStorage = createStorageHook(() =>
  typeof window !== "undefined" ? window.localStorage : null
);

export const useSessionStorage = createStorageHook(() =>
  typeof window !== "undefined" ? window.sessionStorage : null
);

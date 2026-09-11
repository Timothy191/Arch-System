export interface DebounceOptions {
  leading?: boolean;
  trailing?: boolean;
  maxWait?: number;
}

export interface ThrottleOptions {
  leading?: boolean;
  trailing?: boolean;
}

export interface PollingOptions {
  immediate?: boolean;
  autoStart?: boolean;
}

export interface StorageOptions<T> {
  serializer?: (value: T) => string;
  deserializer?: (raw: string) => T;
  onError?: (error: unknown) => void;
}

export interface ClipboardState {
  value: string | null;
  copied: boolean;
  copy: (text: string) => Promise<boolean>;
  reset: () => void;
}

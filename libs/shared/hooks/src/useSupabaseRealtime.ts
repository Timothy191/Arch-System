"use client";

import { useEffect, useRef, useState } from "react";

export type RealtimeEventType = "INSERT" | "UPDATE" | "DELETE" | "*";

export interface RealtimePayload<T = Record<string, unknown>> {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: T;
  old: Partial<T>;
  table: string;
  schema: string;
}

export interface UseSupabaseRealtimeOptions<T = Record<string, unknown>> {
  /** The Supabase client instance or client factory promise */
  supabaseClient: any;
  /** Name of the PostgreSQL table to subscribe to */
  table: string;
  /** Optional Postgres schema name, defaults to 'public' */
  schema?: string;
  /** Optional filter clause, e.g. `department_id=eq.123` */
  filter?: string;
  /** Event types to listen to: 'INSERT', 'UPDATE', 'DELETE', or '*' */
  event?: RealtimeEventType;
  /** Callback fired on any matched CDC change */
  onChange?: (payload: RealtimePayload<T>) => void;
  /** Callback fired on INSERT events */
  onInsert?: (record: T) => void;
  /** Callback fired on UPDATE events */
  onUpdate?: (newRecord: T, oldRecord: Partial<T>) => void;
  /** Callback fired on DELETE events */
  onDelete?: (oldRecord: Partial<T>) => void;
  /** Whether the subscription is enabled, defaults to true */
  enabled?: boolean;
}

/**
 * useSupabaseRealtime
 *
 * Declarative hook for PostgreSQL Change Data Capture (CDC) subscriptions.
 * Automatically handles channel lifecycle, filtering, and cleanup on unmount.
 */
export function useSupabaseRealtime<T = Record<string, unknown>>({
  supabaseClient,
  table,
  schema = "public",
  filter,
  event = "*",
  onChange,
  onInsert,
  onUpdate,
  onDelete,
  enabled = true,
}: UseSupabaseRealtimeOptions<T>) {
  const [status, setStatus] = useState<"CONNECTING" | "SUBSCRIBED" | "TIMED_OUT" | "CLOSED">("CONNECTING");
  const [lastError, setLastError] = useState<Error | null>(null);

  // Store stable callback references
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onInsertRef = useRef(onInsert);
  onInsertRef.current = onInsert;
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;

  useEffect(() => {
    if (!enabled || !supabaseClient || !table) {
      setStatus("CLOSED");
      return;
    }

    let isMounted = true;
    const channelName = `realtime:${schema}:${table}:${filter || "all"}:${Date.now()}`;

    const channel = supabaseClient.channel(channelName);

    const subscriptionConfig: {
      event: string;
      schema: string;
      table: string;
      filter?: string;
    } = {
      event,
      schema,
      table,
    };

    if (filter) {
      subscriptionConfig.filter = filter;
    }

    channel
      .on(
        "postgres_changes",
        subscriptionConfig,
        (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; new: T; old: Partial<T>; table: string; schema: string }) => {
          if (!isMounted) return;

          const formattedPayload: RealtimePayload<T> = {
            eventType: payload.eventType,
            new: payload.new,
            old: payload.old,
            table: payload.table,
            schema: payload.schema,
          };

          onChangeRef.current?.(formattedPayload);

          if (payload.eventType === "INSERT") {
            onInsertRef.current?.(payload.new);
          } else if (payload.eventType === "UPDATE") {
            onUpdateRef.current?.(payload.new, payload.old);
          } else if (payload.eventType === "DELETE") {
            onDeleteRef.current?.(payload.old);
          }
        },
      )
      .subscribe((subscriptionStatus: string, err?: Error) => {
        if (!isMounted) return;

        if (subscriptionStatus === "SUBSCRIBED") {
          setStatus("SUBSCRIBED");
          setLastError(null);
        } else if (subscriptionStatus === "TIMED_OUT") {
          setStatus("TIMED_OUT");
          setLastError(err || new Error("Realtime subscription timed out"));
        } else if (subscriptionStatus === "CLOSED") {
          setStatus("CLOSED");
        }
      });

    return () => {
      isMounted = false;
      if (supabaseClient && channel) {
        supabaseClient.removeChannel(channel).catch(() => {
          // Silent cleanup catch
        });
      }
    };
  }, [supabaseClient, table, schema, filter, event, enabled]);

  return {
    status,
    isConnected: status === "SUBSCRIBED",
    error: lastError,
  };
}

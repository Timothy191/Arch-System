"use client";

import { useEffect, useRef } from "react";

export interface ShortcutDefinition {
  /** Key combination string, e.g. 'ctrl+k', 'shift+?', 'alt+1', 'ctrl+shift+l' */
  shortcut: string;
  /** Action handler invoked when shortcut matches */
  handler: (event: KeyboardEvent) => void;
  /** Whether to trigger even if user is focused inside an input/textarea/select */
  allowInInputs?: boolean;
  /** Whether to prevent default browser behavior (default: true) */
  preventDefault?: boolean;
  /** Optional description for command palettes and help modals */
  description?: string;
}

export interface UseCommandScopeOptions {
  /** Array of shortcut definitions */
  shortcuts: ShortcutDefinition[];
  /** Whether the entire scope is enabled (default: true) */
  enabled?: boolean;
  /** Target HTML element or window to attach listener to */
  targetElement?: HTMLElement | Window | null;
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.split("+").map(normalizeKey);
  const key = normalizeKey(event.key);

  const requireCtrl = parts.includes("ctrl") || parts.includes("control");
  const requireCmd = parts.includes("cmd") || parts.includes("meta");
  const requireAlt = parts.includes("alt");
  const requireShift = parts.includes("shift");

  // Filter out modifier names to isolate the target key
  const targetKeyParts = parts.filter(
    (p) => !["ctrl", "control", "cmd", "meta", "alt", "shift"].includes(p),
  );

  const targetKey = targetKeyParts[0];

  const ctrlMatches = requireCtrl ? event.ctrlKey : !event.ctrlKey || parts.includes("cmd");
  const metaMatches = requireCmd ? event.metaKey : !event.metaKey || parts.includes("ctrl");
  const altMatches = requireAlt ? event.altKey : !event.altKey;
  const shiftMatches = requireShift ? event.shiftKey : !event.shiftKey;

  // Handle Ctrl or Meta interchangeably if specified as 'mod'
  if (parts.includes("mod")) {
    const hasMod = event.ctrlKey || event.metaKey;
    if (!hasMod) return false;
  } else {
    if (requireCtrl && !event.ctrlKey) return false;
    if (requireCmd && !event.metaKey) return false;
    if (requireAlt !== event.altKey) return false;
    if (requireShift !== event.shiftKey) return false;
  }

  if (!targetKey) return false;

  return key === targetKey || event.code.toLowerCase() === targetKey;
}

function isInputFocused(): boolean {
  if (typeof document === "undefined") return false;
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    (active as HTMLElement).isContentEditable
  );
}

/**
 * useCommandScope
 *
 * Scoped keyboard shortcut manager for industrial control rooms and modal dialogs.
 * Safely guards against input-typing conflicts unless explicitly allowed.
 */
export function useCommandScope({
  shortcuts,
  enabled = true,
  targetElement,
}: UseCommandScopeOptions) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const target = targetElement ?? window;

    const handleKeyDown = (event: Event) => {
      const keyboardEvent = event as KeyboardEvent;
      const insideInput = isInputFocused();

      for (const item of shortcutsRef.current) {
        if (!item.allowInInputs && insideInput) {
          continue;
        }

        if (matchesShortcut(keyboardEvent, item.shortcut)) {
          if (item.preventDefault !== false) {
            keyboardEvent.preventDefault();
          }
          item.handler(keyboardEvent);
          break;
        }
      }
    };

    target.addEventListener("keydown", handleKeyDown);

    return () => {
      target.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, targetElement]);
}

'use client';

import type { AssistDataChannelMessage } from '@repo/contract';

export const SENSITIVE_ELEMENT_SELECTOR = [
  'input[type="password"]',
  '[autocomplete*="current-password"]',
  '[autocomplete*="new-password"]',
  '[data-remote-redact="true"]',
  '[data-sensitive="true"]',
  '[data-remote-support-overlay="true"]',
  'iframe',
].join(', ');

const REDACTED_CLASS_NAME = 'arch-remote-redacted-field';
const REDACTED_ATTR = 'data-arch-remote-redacted';

type CoBrowseActionPayload = Extract<
  AssistDataChannelMessage,
  { type: 'cobrowse_action' }
>['action'];

export interface CoBrowseExecutionResult {
  readonly executed: boolean;
  readonly reason?: string;
}

export interface ExecuteCoBrowseOptions {
  readonly action: CoBrowseActionPayload;
  readonly isCobrowseEnabled: boolean;
  readonly onNavigate?: (path: string) => void;
}

/**
 * Checks whether a DOM node (or any ancestor) is security-sensitive or part
 * of the user's consent / kill-switch overlay.
 */
export function isSensitiveElement(target: Element | null): boolean {
  if (!target) return true;
  if (target.closest(SENSITIVE_ELEMENT_SELECTOR)) {
    return true;
  }
  return false;
}

/**
 * Applies or removes visual blur masking over sensitive inputs while portal
 * co-browsing is active.
 */
export function applySensitiveRedaction(enabled: boolean): number {
  if (typeof document === 'undefined') return 0;
  const elements = document.querySelectorAll<HTMLElement>(
    'input[type="password"], [autocomplete*="current-password"], [autocomplete*="new-password"], [data-remote-redact="true"], [data-sensitive="true"]'
  );

  let count = 0;
  for (const element of elements) {
    if (enabled) {
      element.setAttribute(REDACTED_ATTR, 'true');
      element.classList.add(REDACTED_CLASS_NAME);
      element.style.filter = 'blur(6px)';
      count += 1;
    } else if (element.getAttribute(REDACTED_ATTR) === 'true') {
      element.removeAttribute(REDACTED_ATTR);
      element.classList.remove(REDACTED_CLASS_NAME);
      element.style.filter = '';
      count += 1;
    }
  }
  return count;
}

function setReactInputValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  nextValue: string
): void {
  const proto =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  if (descriptor?.set) {
    descriptor.set.call(element, nextValue);
  } else {
    element.value = nextValue;
  }
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function resolveElementAtNormalizedPoint(x: number, y: number): Element | null {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null;
  if (typeof document.elementFromPoint !== 'function') return null;
  const viewportX = Math.max(0, Math.min(window.innerWidth - 1, Math.round(x * window.innerWidth)));
  const viewportY = Math.max(
    0,
    Math.min(window.innerHeight - 1, Math.round(y * window.innerHeight))
  );
  return document.elementFromPoint(viewportX, viewportY);
}

/**
 * Executes a single portal-scoped co-browse action only when the user has
 * explicitly enabled co-browsing and the target element is non-sensitive.
 */
export function executeCoBrowseAction({
  action,
  isCobrowseEnabled,
  onNavigate,
}: ExecuteCoBrowseOptions): CoBrowseExecutionResult {
  if (!isCobrowseEnabled) {
    return { executed: false, reason: 'cobrowse_disabled' };
  }
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return { executed: false, reason: 'ssr_unavailable' };
  }

  if (action.kind === 'scroll') {
    window.scrollBy({ left: action.deltaX, top: action.deltaY, behavior: 'auto' });
    return { executed: true };
  }

  if (action.kind === 'navigate') {
    if (!action.path.startsWith('/') || action.path.startsWith('//')) {
      return { executed: false, reason: 'invalid_internal_path' };
    }
    onNavigate?.(action.path);
    return { executed: true };
  }

  const target = resolveElementAtNormalizedPoint(action.x, action.y);
  if (isSensitiveElement(target)) {
    return { executed: false, reason: 'sensitive_element_blocked' };
  }

  if (action.kind === 'click' && target instanceof HTMLElement) {
    target.focus();
    target.click();
    return { executed: true };
  }

  if (
    action.kind === 'input' &&
    (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
  ) {
    target.focus();
    setReactInputValue(target, action.value);
    return { executed: true };
  }

  return { executed: false, reason: 'unsupported_target' };
}

/**
 * Centralized event manager for Arch System custom events.
 * Provides type-safe event dispatching and reduces direct window.dispatchEvent calls.
 */

export interface ActiveModuleChangeEvent {
  name: string;
  title: string;
}

export interface SystemNotificationEvent {
  id: string;
  title: string;
  message: string;
  unread: boolean;
}

export const ARCH_EVENTS = {
  ACTIVE_MODULE_CHANGE: 'arch:active-module-change',
  SYSTEM_NOTIFICATION: 'arch-system-notification',
} as const;

/**
 * Dispatches the active module change event.
 * Used when users navigate between departments or change filter views.
 */
export function dispatchActiveModuleChange(detail: ActiveModuleChangeEvent): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ARCH_EVENTS.ACTIVE_MODULE_CHANGE, { detail }));
}

/**
 * Dispatches a system notification event.
 * Used for employee clearance notices and other system-wide alerts.
 */
export function dispatchSystemNotification(detail: SystemNotificationEvent): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ARCH_EVENTS.SYSTEM_NOTIFICATION, { detail }));
}

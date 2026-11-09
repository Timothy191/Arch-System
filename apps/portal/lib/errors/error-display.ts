import {
  isAppError,
  isAuthError,
  isNotFoundError,
  isValidationError,
} from '@/lib/errors/error-classes';

export interface ErrorTitleOptions {
  readonly fallbackTitle?: string;
  readonly notFoundTitle?: string;
  readonly checkValidation?: boolean;
}

const DEFAULT_FALLBACK_TITLE = 'Something went wrong';
const DEFAULT_NOT_FOUND_TITLE = 'Not found';
const ACCESS_DENIED_TITLE = 'Access denied';
const INVALID_INPUT_TITLE = 'Invalid input';
const DEFAULT_FALLBACK_MESSAGE = 'An unexpected error occurred. Please try again.';
const HUB_ACTION_LINK = { href: '/', label: 'Back to Hub' } as const;
const LOGIN_ACTION_LINK = { href: '/login', label: 'Sign in' } as const;

export function getErrorTitle(error: Error, options?: ErrorTitleOptions): string {
  if (isNotFoundError(error)) {
    return options?.notFoundTitle ?? DEFAULT_NOT_FOUND_TITLE;
  }
  if (isAuthError(error)) {
    return ACCESS_DENIED_TITLE;
  }
  if (options?.checkValidation && isValidationError(error)) {
    return INVALID_INPUT_TITLE;
  }
  if (isAppError(error)) {
    return error.name.replace(/([A-Z])/g, ' $1').trim();
  }
  return options?.fallbackTitle ?? DEFAULT_FALLBACK_TITLE;
}

export function getErrorMessage(error: Error, fallbackMessage = DEFAULT_FALLBACK_MESSAGE): string {
  if (isAppError(error)) {
    return error.message;
  }
  return error.message || fallbackMessage;
}

export function getActionLink(error: Error): { href: string; label: string } {
  if (isNotFoundError(error)) {
    return HUB_ACTION_LINK;
  }
  if (isAuthError(error)) {
    return LOGIN_ACTION_LINK;
  }
  return HUB_ACTION_LINK;
}

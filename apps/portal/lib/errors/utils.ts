import { toast } from "sonner";
import { isAppError } from "./error-classes";

/**
 * Extracts a safe, user-facing error message from any error object.
 */
export function extractErrorMessage(
  error: unknown,
  fallbackMessage = "An unexpected error occurred",
): string {
  if (!error) return fallbackMessage;
  if (typeof error === "string") return error;
  if (isAppError(error)) return error.message;
  if (error instanceof Error) return error.message;

  if (typeof error === "object") {
    // Handle standard API response error shapes
    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }
    if ("error" in error && typeof error.error === "string") {
      return error.error;
    }
  }

  return fallbackMessage;
}

/**
 * Standardized API error handler that extracts the message and shows a toast.
 */
export function handleApiError(
  error: unknown,
  fallbackMessage?: string,
): string {
  const message = extractErrorMessage(error, fallbackMessage);
  toast.error(message);
  return message;
}

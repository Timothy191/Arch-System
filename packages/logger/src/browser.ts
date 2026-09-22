/* eslint-disable no-console -- Browser logger intentionally wraps console */
import type { Logger, LogLevel } from "./types";

function baseLog(level: LogLevel, msg: string, ...args: unknown[]) {
  // Mask potential PII/sensitive data (basic implementation)
  const safeMsg = msg.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    "[EMAIL_REDACTED]",
  );

  const payloadData = {
    level,
    msg: safeMsg,
    timestamp: new Date().toISOString(),
    ...(args.length > 0 ? { data: args } : {}),
  };
  const payload = JSON.stringify(payloadData);

  switch (level) {
    case "debug":
      console.debug(payload);
      break;
    case "info":
      console.info(payload);
      break;
    case "warn":
      console.warn(payload);
      sendRemoteLog(payload);
      break;
    case "error":
      console.error(payload);
      sendRemoteLog(payload);
      break;
  }
}

function sendRemoteLog(payload: string) {
  if (typeof window === "undefined") return;
  // Send asynchronously without blocking or throwing unhandled rejections
  fetch("/api/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {
    /* ignore */
  });
}

/**
 * Browser-compatible logger.
 * Thin wrapper around console that outputs structured JSON.
 */
export const logger: Logger = {
  debug(msg, ...args) {
    baseLog("debug", msg, ...args);
  },
  info(msg, ...args) {
    baseLog("info", msg, ...args);
  },
  warn(msg, ...args) {
    baseLog("warn", msg, ...args);
  },
  error(msg, ...args) {
    baseLog("error", msg, ...args);
  },
  child(bindings) {
    const prefix = Object.entries(bindings)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");
    return {
      debug: (msg: string, ...args: unknown[]) => baseLog("debug", `[${prefix}] ${msg}`, ...args),
      info: (msg: string, ...args: unknown[]) => baseLog("info", `[${prefix}] ${msg}`, ...args),
      warn: (msg: string, ...args: unknown[]) => baseLog("warn", `[${prefix}] ${msg}`, ...args),
      error: (msg: string, ...args: unknown[]) => baseLog("error", `[${prefix}] ${msg}`, ...args),
      child: (nestedBindings: Record<string, unknown>) =>
        logger.child({ ...bindings, ...nestedBindings }),
    };
  },
};

import pino from "pino";

// AGENT-TRACE: Disable pino-pretty worker thread transport in test environments (Jest/Vitest)
const isTest = process.env.NODE_ENV === "test" || !!process.env.JEST_WORKER_ID;
const isDev = process.env.NODE_ENV !== "production";
const isVercel = !!process.env.VERCEL;

const level = process.env.LOG_LEVEL ?? (isDev ? "debug" : "info");

let canUsePretty = false;
if (isDev && !isVercel && !isTest && process.env.ENABLE_PINO_PRETTY === "true") {
  try {
    // AGENT-TRACE: Dynamic evaluation avoids Turbopack static AST analysis when package is optional
    const pkg = ["pino", "pretty"].join("-");
    const dynamicRequire = eval("require") as NodeRequire;
    dynamicRequire.resolve(pkg);
    canUsePretty = true;
  } catch {
    canUsePretty = false;
  }
}

export function createLogger(name?: string) {
  return pino({
    name,
    level,
    ...(canUsePretty
      ? {
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "HH:MM:ss.l",
              ignore: "pid,hostname",
            },
          },
        }
      : {
          formatters: {
            level(label) {
              return { level: label };
            },
          },
        }),
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        'req.headers["x-api-key"]',
        "password",
        "token",
        "secret",
      ],
      censor: "[REDACTED]",
    },
  });
}

/**
 * Default application-wide logger instance.
 */
export const logger = createLogger("arch-portal");

/**
 * Create a child logger with additional bound context.
 */
export function createChildLogger(bindings: Record<string, unknown>, name?: string) {
  return (name ? createLogger(name) : logger).child(bindings);
}

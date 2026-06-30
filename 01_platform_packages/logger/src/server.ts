import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";
const isVercel = !!process.env.VERCEL;

const level = process.env.LOG_LEVEL ?? (isDev ? "debug" : "info");

export function createLogger(name?: string) {
  return pino({
    name,
    level,
    ...(isDev && !isVercel
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

/**
 * Simple error classes to replace @repo/errors package
 */
/* AGENT-TRACE: File-level eslint-disable for no-unused-vars
 * These public constructor parameters define the error interface but are flagged as unused by ESLint
 * This is intentional - they are part of the public API for the error classes
 * If modifying error handling, maintain this pattern or consider re-integrating @repo/errors
 */
/* eslint-disable no-unused-vars */

export class AppError extends Error {
  public code?: string;
  public statusCode?: number;
  public context?: Record<string, unknown>;
  public cause?: unknown;

  constructor(message: string, code?: string, statusCode?: number);
  constructor(
    message: string,
    options?: {
      code?: string;
      statusCode?: number;
      context?: Record<string, unknown>;
      cause?: unknown;
      [key: string]: any;
    },
  );
  constructor(
    message: string,
    codeOrOptions?:
      | string
      | {
          code?: string;
          statusCode?: number;
          context?: Record<string, unknown>;
          cause?: unknown;
          [key: string]: any;
        },
    statusCode?: number,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);

    if (typeof codeOrOptions === "string") {
      this.code = codeOrOptions;
      this.statusCode = statusCode ?? 500;
    } else if (codeOrOptions && typeof codeOrOptions === "object") {
      this.code = codeOrOptions.code;
      this.statusCode = codeOrOptions.statusCode ?? 500;
      this.context = codeOrOptions.context;
      this.cause = codeOrOptions.cause;
      // Capture extra parameters in context
      const { code, statusCode: _, context, cause, ...extra } = codeOrOptions;
      if (Object.keys(extra).length > 0) {
        this.context = {
          ...this.context,
          ...extra,
        };
      }
    }
  }
}

export class APIError extends AppError {
  public response?: Response;

  constructor(message: string, response?: Response);
  constructor(
    message: string,
    options?: {
      statusCode?: number;
      context?: Record<string, unknown>;
      cause?: unknown;
      [key: string]: any;
    },
  );
  constructor(
    message: string,
    responseOrOptions?:
      | Response
      | {
          statusCode?: number;
          context?: Record<string, unknown>;
          cause?: unknown;
          [key: string]: any;
        },
  ) {
    let statusCode: number | undefined;
    let response: Response | undefined;
    let context: Record<string, unknown> | undefined;
    let cause: unknown;
    let extra: Record<string, unknown> = {};

    if (responseOrOptions) {
      if (
        "status" in responseOrOptions &&
        typeof (responseOrOptions as any).status === "number"
      ) {
        response = responseOrOptions as Response;
        statusCode = (responseOrOptions as any).status;
      } else {
        statusCode = (responseOrOptions as any).statusCode;
        context = (responseOrOptions as any).context;
        cause = (responseOrOptions as any).cause;
        const {
          statusCode: _,
          context: __,
          cause: ___,
          ...rest
        } = responseOrOptions as any;
        extra = rest;
      }
    }
    super(message, "API_ERROR", statusCode ?? 500);
    this.response = response;
    if (context) this.context = context;
    if (cause) this.cause = cause;
    if (Object.keys(extra).length > 0) {
      this.context = {
        ...this.context,
        ...extra,
      };
    }
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    options?: {
      field?: string;
      value?: unknown;
      context?: Record<string, unknown>;
      cause?: unknown;
      [key: string]: any;
    },
  ) {
    super(message, {
      code: "VALIDATION_ERROR",
      statusCode: 400,
      cause: options?.cause,
      context: {
        ...options?.context,
        ...(options?.field && { field: options.field }),
        ...(options?.value !== undefined && { value: options.value }),
      },
    });
    if (options) {
      const { field, value, context, cause, ...extra } = options;
      if (Object.keys(extra).length > 0) {
        this.context = {
          ...this.context,
          ...extra,
        };
      }
    }
  }
}

export class AuthError extends AppError {
  constructor(
    message: string = "Authentication failed",
    options?: {
      cause?: unknown;
      context?: Record<string, unknown>;
      [key: string]: any;
    },
  ) {
    super(message, {
      code: "AUTH_ERROR",
      statusCode: 401,
      cause: options?.cause,
      context: options?.context,
    });
    if (options) {
      const { cause, context, ...extra } = options;
      if (Object.keys(extra).length > 0) {
        this.context = {
          ...this.context,
          ...extra,
        };
      }
    }
  }
}

export class DatabaseError extends AppError {
  constructor(
    message: string,
    options?: {
      cause?: unknown;
      context?: Record<string, unknown>;
      [key: string]: any;
    },
  ) {
    super(message, {
      code: "DATABASE_ERROR",
      statusCode: 500,
      cause: options?.cause,
      context: options?.context,
    });
    if (options) {
      const { cause, context, ...extra } = options;
      if (Object.keys(extra).length > 0) {
        this.context = {
          ...this.context,
          ...extra,
        };
      }
    }
  }
}

export class NotFoundError extends AppError {
  constructor(
    message: string = "Resource not found",
    options?: {
      cause?: unknown;
      context?: Record<string, unknown>;
      [key: string]: any;
    },
  ) {
    super(message, {
      code: "NOT_FOUND",
      statusCode: 404,
      cause: options?.cause,
      context: options?.context,
    });
    if (options) {
      const { cause, context, ...extra } = options;
      if (Object.keys(extra).length > 0) {
        this.context = {
          ...this.context,
          ...extra,
        };
      }
    }
  }
}

export class ConflictError extends AppError {
  constructor(
    message: string = "Resource conflict",
    options?: {
      cause?: unknown;
      context?: Record<string, unknown>;
      [key: string]: any;
    },
  ) {
    super(message, {
      code: "CONFLICT",
      statusCode: 409,
      cause: options?.cause,
      context: options?.context,
    });
    if (options) {
      const { cause, context, ...extra } = options;
      if (Object.keys(extra).length > 0) {
        this.context = {
          ...this.context,
          ...extra,
        };
      }
    }
  }
}

export class ForbiddenError extends AppError {
  constructor(
    message: string = "Access forbidden",
    options?: {
      cause?: unknown;
      context?: Record<string, unknown>;
      [key: string]: any;
    },
  ) {
    super(message, {
      code: "FORBIDDEN",
      statusCode: 403,
      cause: options?.cause,
      context: options?.context,
    });
    if (options) {
      const { cause, context, ...extra } = options;
      if (Object.keys(extra).length > 0) {
        this.context = {
          ...this.context,
          ...extra,
        };
      }
    }
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

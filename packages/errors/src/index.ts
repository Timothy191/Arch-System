export class AppError extends Error {
  public code?: string;
  public statusCode?: number;
  public context?: Record<string, unknown>;
  public cause?: Error;

  constructor(message: string, code?: string, statusCode?: number);
  constructor(
    message: string,
    options?: {
      code?: string;
      statusCode?: number;
      context?: Record<string, unknown>;
      cause?: Error;
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
          cause?: Error;
          [key: string]: any;
        },
    statusCode?: number,
  ) {
    super(message);
    this.name = "AppError";

    if (typeof codeOrOptions === "string") {
      this.code = codeOrOptions;
      this.statusCode = statusCode;
    } else if (codeOrOptions && typeof codeOrOptions === "object") {
      this.code = codeOrOptions.code;
      this.statusCode = codeOrOptions.statusCode;
      this.context = codeOrOptions.context;
      this.cause = codeOrOptions.cause;
      // Capture extra parameters in context
      const { code, statusCode, context, cause, ...extra } = codeOrOptions;
      if (Object.keys(extra).length > 0) {
        this.context = {
          ...this.context,
          ...extra,
        };
      }
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
      cause?: Error;
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
    this.name = "ValidationError";
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
    message: string,
    options?: {
      cause?: Error;
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
    this.name = "AuthError";
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
    message: string,
    options?: {
      cause?: Error;
      context?: Record<string, unknown>;
      [key: string]: any;
    },
  ) {
    super(message, {
      code: "FORBIDDEN_ERROR",
      statusCode: 403,
      cause: options?.cause,
      context: options?.context,
    });
    this.name = "ForbiddenError";
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
    message: string,
    options?: {
      cause?: Error;
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
    this.name = "NotFoundError";
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
    message: string,
    options?: {
      cause?: Error;
      context?: Record<string, unknown>;
      [key: string]: any;
    },
  ) {
    super(message, {
      code: "CONFLICT_ERROR",
      statusCode: 409,
      cause: options?.cause,
      context: options?.context,
    });
    this.name = "ConflictError";
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

export class APIError extends AppError {
  public response?: Response;

  constructor(message: string, response?: Response);
  constructor(
    message: string,
    options?: {
      statusCode?: number;
      context?: Record<string, unknown>;
      cause?: Error;
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
          cause?: Error;
          [key: string]: any;
        },
  ) {
    let statusCode: number | undefined;
    let response: Response | undefined;
    let context: Record<string, unknown> | undefined;
    let cause: Error | undefined;
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
    super(message, "API_ERROR", statusCode);
    this.response = response;
    this.name = "APIError";
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

export class DatabaseError extends AppError {
  constructor(
    message: string,
    options?: {
      cause?: Error;
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
    this.name = "DatabaseError";
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

export class RateLimitError extends AppError {
  constructor(
    message: string,
    options?: {
      cause?: Error;
      context?: Record<string, unknown>;
      [key: string]: any;
    },
  ) {
    super(message, {
      code: "RATE_LIMIT_ERROR",
      statusCode: 429,
      cause: options?.cause,
      context: options?.context,
    });
    this.name = "RateLimitError";
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

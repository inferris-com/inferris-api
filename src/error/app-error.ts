import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import {config} from "../config.js";

export const appErrorKinds = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  internal: 500,
} as const;

export type AppErrorKind = keyof typeof appErrorKinds;

export type AppErrorOptions = {
  code: string;
  message: string;
  details?: unknown;
  cause?: unknown;
};

type ErrorResponseBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export class AppError extends Error {
  readonly code: string;
  readonly details?: unknown;
  readonly kind: AppErrorKind;

  protected constructor(kind: AppErrorKind, options: AppErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = new.target.name;
    this.kind = kind;
    this.code = options.code;

    if ("details" in options) {
      this.details = options.details;
    }
  }
}

export class ValidationError extends AppError {
  constructor(options: AppErrorOptions) {
    super("validation", options);
  }
}

export class UnauthorizedError extends AppError {
  constructor(options: AppErrorOptions) {
    super("unauthorized", options);
  }
}

export class ForbiddenError extends AppError {
  constructor(options: AppErrorOptions) {
    super("forbidden", options);
  }
}

export class NotFoundError extends AppError {
  constructor(options: AppErrorOptions) {
    super("not_found", options);
  }
}

export class ConflictError extends AppError {
  constructor(options: AppErrorOptions) {
    super("conflict", options);
  }
}

export class RateLimitedError extends AppError {
  constructor(options: AppErrorOptions) {
    super("rate_limited", options);
  }
}

export class InternalError extends AppError {
  constructor(options: AppErrorOptions) {
    super("internal", options);
  }
}

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response<ErrorResponseBody>,
  _next: NextFunction,
) => {
  const appError =
    err instanceof AppError
      ? err
      : new InternalError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error && config.isDevelopment && config.logLevel === "debug" ? err.message : "Internal server error",
          cause: err,
        });

  const responseBody: ErrorResponseBody = {
    error: {
      code: appError.code,
      message: appError.message,
    },
  };

  if (appError.details !== undefined) {
    responseBody.error.details = appError.details;
  }

  res.status(appErrorKinds[appError.kind]).json(responseBody);
};

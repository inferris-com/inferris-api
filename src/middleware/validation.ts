import type { Request, RequestHandler } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import type { ParsedQs } from "qs";
import type { infer as zInfer, ZodType } from "zod";

import { ValidationError } from "@/error/app-error.js";

export type RequestInput = "body" | "params" | "query" | "headers";

export type RequestValidationSchemas = Partial<Record<RequestInput, ZodType<unknown>>>;

export type ValidatedRequest<
  Schemas extends RequestValidationSchemas,
  ResponseBody = unknown,
> = Request<
  InferSchema<Schemas["params"]>,
  ResponseBody,
  InferSchema<Schemas["body"]>,
  InferSchema<Schemas["query"]>
> & {
  headers: Request["headers"] & InferSchema<Schemas["headers"]>;
};

type InferSchema<Schema> = Schema extends ZodType ? zInfer<Schema> : unknown;
type InferParams<Schema> = Schema extends ZodType ? zInfer<Schema> : ParamsDictionary;
type InferQuery<Schema> = Schema extends ZodType ? zInfer<Schema> : ParsedQs;

type ValidationIssue = {
  path: string;
  message: string;
  code: string;
};

type RequestInputCarrier = {
  body: unknown;
  params: unknown;
  query: unknown;
  headers: unknown;
};

export function validateRequest<Schemas extends RequestValidationSchemas>(
  schemas: Schemas,
): RequestHandler<
  InferParams<Schemas["params"]>,
  unknown,
  InferSchema<Schemas["body"]>,
  InferQuery<Schemas["query"]>
> {
  return (req, _res, next) => {
    const validationErrors: Partial<Record<RequestInput, ValidationIssue[]>> = {};

    for (const input of Object.keys(schemas) as RequestInput[]) {
      const schema = schemas[input];
      if (!schema) {
        continue;
      }

      const result = schema.safeParse(getRequestInput(req, input));

      if (!result.success) {
        validationErrors[input] = result.error.issues.map((issue) => ({
          path: issue.path.map(String).join("."),
          message: issue.message,
          code: issue.code,
        }));
        continue;
      }

      setRequestInput(req, input, result.data);
    }

    if (Object.keys(validationErrors).length > 0) {
      next(
        new ValidationError({
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: validationErrors,
        }),
      );
      return;
    }

    next();
  };
}

function getRequestInput(req: RequestInputCarrier, input: RequestInput): unknown {
  switch (input) {
    case "body":
      return req.body;
    case "params":
      return req.params;
    case "query":
      return req.query;
    case "headers":
      return req.headers;
  }
}

function setRequestInput(req: RequestInputCarrier, input: RequestInput, value: unknown): void {
  Object.defineProperty(req, input, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

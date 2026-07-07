import type { RouteConfig, ZodMediaTypeObject } from "@asteasolutions/zod-to-openapi";
import z from "zod";

import { apiErrorEnvelopeSchema } from "./envelope.schemas.js";

export const userSecurity: NonNullable<RouteConfig["security"]> = [
  { bearerAuth: [] },
];

export const serviceSecurity: NonNullable<RouteConfig["security"]> = [
  { apiKeyAuth: [] },
];

export const userOrServiceSecurity: NonNullable<RouteConfig["security"]> = [
  ...userSecurity,
  ...serviceSecurity,
];

const responseEnvelopeSchema = z
  .object({
    data: z.unknown(),
  })
  .passthrough();

const listResponseEnvelopeSchema = z
  .object({
    data: z.array(z.unknown()),
    meta: z
      .object({
        count: z.number().int().nonnegative().optional(),
        total: z.number().int().nonnegative().optional(),
        limit: z.number().int().positive().optional(),
        offset: z.number().int().nonnegative().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export function jsonBody(schema: z.ZodType): ZodMediaTypeObject {
  return { schema };
}

export function successResponse(schema: z.ZodType, description?: string): RouteConfig["responses"][string];
export function successResponse(description?: string): RouteConfig["responses"][string];
export function successResponse(
  schemaOrDescription: z.ZodType | string = "Successful response",
  description = "Successful response",
) {
  const schema = typeof schemaOrDescription === "string" ? responseEnvelopeSchema : schemaOrDescription;
  const resolvedDescription =
    typeof schemaOrDescription === "string" ? schemaOrDescription : description;

  return {
    description: resolvedDescription,
    content: {
      "application/json": jsonBody(schema),
    },
  };
}

export function listResponse(schema: z.ZodType, description?: string): RouteConfig["responses"][string];
export function listResponse(description?: string): RouteConfig["responses"][string];
export function listResponse(
  schemaOrDescription: z.ZodType | string = "Successful list response",
  description = "Successful list response",
) {
  const schema =
    typeof schemaOrDescription === "string" ? listResponseEnvelopeSchema : schemaOrDescription;
  const resolvedDescription =
    typeof schemaOrDescription === "string" ? schemaOrDescription : description;

  return {
    description: resolvedDescription,
    content: {
      "application/json": jsonBody(schema),
    },
  };
}

export function errorResponse(description: string) {
  return {
    description,
    content: {
      "application/json": jsonBody(apiErrorEnvelopeSchema),
    },
  };
}

export const noContentResponse = {
  description: "No content",
};

export const standardErrorResponses = {
  "400": errorResponse("Bad request"),
  "401": errorResponse("Unauthorized"),
  "403": errorResponse("Forbidden"),
  "404": errorResponse("Not found"),
};

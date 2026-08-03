import type { RouteConfig, ZodMediaTypeObject } from "@asteasolutions/zod-to-openapi";
import type { ZodType } from "zod";

import { apiErrorEnvelopeSchema, listEnvelope, successEnvelope } from "@/openapi/envelope.schemas.js";

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

export function jsonBody(schema: ZodType): ZodMediaTypeObject {
  return { schema };
}

export function successResponse(
  dataSchema: ZodType,
  description = "Successful response",
): RouteConfig["responses"][string] {
  return {
    description,
    content: {
      "application/json": jsonBody(successEnvelope(dataSchema)),
    },
  };
}

export function listResponse(
  dataSchema: ZodType,
  description = "Successful list response",
): RouteConfig["responses"][string] {
  return {
    description,
    content: {
      "application/json": jsonBody(listEnvelope(dataSchema)),
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

import type {RouteConfig, ZodMediaTypeObject} from "@asteasolutions/zod-to-openapi";
import z from "zod";

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

export const actingActorHeaderSchema = z.object({
  "x-inferris-actor-id": z
    .guid()
    .optional()
    .describe("Acting actor UUID. Required for API-key requests to executor-stamped mutations."),
});

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

const errorResponseSchema = z
  .object({
    error: z
      .object({
        message: z.string(),
        code: z.string().optional(),
        details: z.unknown().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export function jsonBody(schema: z.ZodType): ZodMediaTypeObject {
  return { schema };
}

export function successResponse(description = "Successful response") {
  return {
    description,
    content: {
      "application/json": jsonBody(responseEnvelopeSchema),
    },
  };
}

export function listResponse(description = "Successful list response") {
  return {
    description,
    content: {
      "application/json": jsonBody(listResponseEnvelopeSchema),
    },
  };
}

export function errorResponse(description: string) {
  return {
    description,
    content: {
      "application/json": jsonBody(errorResponseSchema),
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

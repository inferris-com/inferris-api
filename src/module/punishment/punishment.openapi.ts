import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  userOrServiceSecurity,
  jsonBody,
  paginatedResponse,
  standardErrorResponses,
  successResponse,
} from "@/openapi/openapi.helpers.js";
import {
  punishmentListItemResponseSchema,
  punishmentResponseSchema,
} from "@/module/punishment/punishment.response-types.js";
import {
  createPunishmentBodySchema,
  listPunishmentsQuerySchema,
  punishmentCodeParamsSchema,
  punishmentIdParamsSchema,
  revokePunishmentBodySchema,
} from "@/module/punishment/punishment.schemas.js";

export function registerPunishmentOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/punishments",
    tags: ["Punishments"],
    security: userOrServiceSecurity,
    summary: "List punishments",
    description:
      "Use include=identities to receive subjectActor and issuerActor summaries with each row. This expansion also requires actors:read and players:read for API keys, or an Argus moderator role. Missing or archived players use the actor identity; detail and mutation responses are unchanged.",
    operationId: "listPunishments",
    request: { query: listPunishmentsQuerySchema },
    responses: {
      "200": paginatedResponse(punishmentListItemResponseSchema),
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/punishments/code/{code}",
    tags: ["Punishments"],
    security: userOrServiceSecurity,
    summary: "Get a punishment by code",
    operationId: "getPunishmentByCode",
    request: { params: punishmentCodeParamsSchema },
    responses: { "200": successResponse(punishmentResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/punishments/{punishmentId}",
    tags: ["Punishments"],
    security: userOrServiceSecurity,
    summary: "Get a punishment",
    operationId: "getPunishment",
    request: { params: punishmentIdParamsSchema },
    responses: { "200": successResponse(punishmentResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/punishments",
    tags: ["Punishments"],
    security: userOrServiceSecurity,
    summary: "Create a punishment",
    operationId: "createPunishment",
    request: {
      body: {
        required: true,
        content: { "application/json": jsonBody(createPunishmentBodySchema) },
      },
    },
    responses: {
      "201": successResponse(punishmentResponseSchema, "Punishment created"),
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/punishments/{punishmentId}/revoke",
    tags: ["Punishments"],
    security: userOrServiceSecurity,
    summary: "Revoke a punishment",
    operationId: "revokePunishment",
    request: {
      params: punishmentIdParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(revokePunishmentBodySchema) },
      },
    },
    responses: {
      "200": successResponse(punishmentResponseSchema, "Punishment revoked"),
      ...standardErrorResponses,
    },
  });
}

import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  userOrServiceSecurity,
  jsonBody,
  listResponse,
  standardErrorResponses,
  successResponse,
} from "../../openapi/openapi.helpers.js";
import {
  createPunishmentBodySchema,
  listPunishmentsQuerySchema,
  punishmentIdParamsSchema,
  revokePunishmentBodySchema,
} from "./punishment.schemas.js";

export function registerPunishmentOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/punishments",
    tags: ["Punishments"],
    security: userOrServiceSecurity,
    summary: "List punishments",
    request: { query: listPunishmentsQuerySchema },
    responses: { "200": listResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/punishments/{punishmentId}",
    tags: ["Punishments"],
    security: userOrServiceSecurity,
    summary: "Get a punishment",
    request: { params: punishmentIdParamsSchema },
    responses: { "200": successResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/punishments",
    tags: ["Punishments"],
    security: userOrServiceSecurity,
    summary: "Create a punishment",
    request: {
      body: {
        required: true,
        content: { "application/json": jsonBody(createPunishmentBodySchema) },
      },
    },
    responses: { "201": successResponse("Punishment created"), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/punishments/{punishmentId}/revoke",
    tags: ["Punishments"],
    security: userOrServiceSecurity,
    summary: "Revoke a punishment",
    request: {
      params: punishmentIdParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(revokePunishmentBodySchema) },
      },
    },
    responses: { "200": successResponse("Punishment revoked"), ...standardErrorResponses },
  });
}

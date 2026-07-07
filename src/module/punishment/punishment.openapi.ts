import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  userOrServiceSecurity,
  jsonBody,
  listResponse,
  standardErrorResponses,
  successResponse,
} from "../../openapi/openapi.helpers.js";
import { listEnvelopeSchema, successEnvelopeSchema } from "../../openapi/envelope.schemas.js";
import { punishmentResponseSchema } from "./punishment.response-types.js";
import {
  createPunishmentBodySchema,
  listPunishmentsQuerySchema,
  punishmentIdParamsSchema,
  revokePunishmentBodySchema,
} from "./punishment.schemas.js";

const punishmentEnvelopeSchema = successEnvelopeSchema(
  "PunishmentEnvelope",
  punishmentResponseSchema,
);
const punishmentListEnvelopeSchema = listEnvelopeSchema(
  "PunishmentListEnvelope",
  punishmentResponseSchema,
);

export function registerPunishmentOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/punishments",
    tags: ["Punishments"],
    security: userOrServiceSecurity,
    summary: "List punishments",
    operationId: "listPunishments",
    request: { query: listPunishmentsQuerySchema },
    responses: { "200": listResponse(punishmentListEnvelopeSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/punishments/{punishmentId}",
    tags: ["Punishments"],
    security: userOrServiceSecurity,
    summary: "Get a punishment",
    operationId: "getPunishment",
    request: { params: punishmentIdParamsSchema },
    responses: { "200": successResponse(punishmentEnvelopeSchema), ...standardErrorResponses },
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
      "201": successResponse(punishmentEnvelopeSchema, "Punishment created"),
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
      "200": successResponse(punishmentEnvelopeSchema, "Punishment revoked"),
      ...standardErrorResponses,
    },
  });
}

import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  userOrServiceSecurity,
  jsonBody,
  listResponse,
  standardErrorResponses,
  successResponse,
} from "../../openapi/openapi.helpers.js";
import { listEnvelopeSchema, successEnvelopeSchema } from "../../openapi/envelope.schemas.js";
import { modCaseActorResponseSchema, modCaseResponseSchema } from "./mod-case.response-types.js";
import {
  createModCaseActorBodySchema,
  createModCaseBodySchema,
  listModCasesQuerySchema,
  modCaseIdParamsSchema,
  updateModCaseBodySchema,
} from "./mod-case.schemas.js";

const modCaseEnvelopeSchema = successEnvelopeSchema("ModCaseEnvelope", modCaseResponseSchema);
const modCaseListEnvelopeSchema = listEnvelopeSchema("ModCaseListEnvelope", modCaseResponseSchema);
const modCaseActorEnvelopeSchema = successEnvelopeSchema(
  "ModCaseActorEnvelope",
  modCaseActorResponseSchema,
);
const modCaseActorListEnvelopeSchema = listEnvelopeSchema(
  "ModCaseActorListEnvelope",
  modCaseActorResponseSchema,
);

export function registerModCaseOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/mod-cases",
    tags: ["Mod Cases"],
    security: userOrServiceSecurity,
    summary: "List moderation cases",
    operationId: "listModerationCases",
    request: { query: listModCasesQuerySchema },
    responses: { "200": listResponse(modCaseListEnvelopeSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/mod-cases",
    tags: ["Mod Cases"],
    security: userOrServiceSecurity,
    summary: "Create a moderation case",
    operationId: "createModerationCase",
    request: {
      body: { required: true, content: { "application/json": jsonBody(createModCaseBodySchema) } },
    },
    responses: {
      "201": successResponse(modCaseEnvelopeSchema, "Moderation case created"),
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/mod-cases/{caseId}",
    tags: ["Mod Cases"],
    security: userOrServiceSecurity,
    summary: "Get a moderation case",
    operationId: "getModerationCase",
    request: { params: modCaseIdParamsSchema },
    responses: { "200": successResponse(modCaseEnvelopeSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "patch",
    path: "/mod-cases/{caseId}",
    tags: ["Mod Cases"],
    security: userOrServiceSecurity,
    summary: "Update a moderation case",
    operationId: "updateModerationCase",
    request: {
      params: modCaseIdParamsSchema,
      body: { required: true, content: { "application/json": jsonBody(updateModCaseBodySchema) } },
    },
    responses: { "200": successResponse(modCaseEnvelopeSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/mod-cases/{caseId}/actors",
    tags: ["Mod Cases"],
    security: userOrServiceSecurity,
    summary: "List moderation case actors",
    operationId: "listModerationCaseActors",
    request: { params: modCaseIdParamsSchema },
    responses: { "200": listResponse(modCaseActorListEnvelopeSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/mod-cases/{caseId}/actors",
    tags: ["Mod Cases"],
    security: userOrServiceSecurity,
    summary: "Add a moderation case actor",
    operationId: "addModerationCaseActor",
    request: {
      params: modCaseIdParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(createModCaseActorBodySchema) },
      },
    },
    responses: {
      "201": successResponse(modCaseActorEnvelopeSchema, "Moderation case actor added"),
      ...standardErrorResponses,
    },
  });
}

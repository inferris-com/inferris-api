import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  userOrServiceSecurity,
  jsonBody,
  listResponse,
  standardErrorResponses,
  successResponse,
} from "../../openapi/openapi.helpers.js";
import {
  createModCaseActorBodySchema,
  createModCaseBodySchema,
  listModCasesQuerySchema,
  modCaseIdParamsSchema,
  updateModCaseBodySchema,
} from "./mod-case.schemas.js";

export function registerModCaseOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/mod-cases",
    tags: ["Mod Cases"],
    security: userOrServiceSecurity,
    summary: "List moderation cases",
    request: { query: listModCasesQuerySchema },
    responses: { "200": listResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/mod-cases",
    tags: ["Mod Cases"],
    security: userOrServiceSecurity,
    summary: "Create a moderation case",
    request: {
      body: { required: true, content: { "application/json": jsonBody(createModCaseBodySchema) } },
    },
    responses: { "201": successResponse("Moderation case created"), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/mod-cases/{caseId}",
    tags: ["Mod Cases"],
    security: userOrServiceSecurity,
    summary: "Get a moderation case",
    request: { params: modCaseIdParamsSchema },
    responses: { "200": successResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "patch",
    path: "/mod-cases/{caseId}",
    tags: ["Mod Cases"],
    security: userOrServiceSecurity,
    summary: "Update a moderation case",
    request: {
      params: modCaseIdParamsSchema,
      body: { required: true, content: { "application/json": jsonBody(updateModCaseBodySchema) } },
    },
    responses: { "200": successResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/mod-cases/{caseId}/actors",
    tags: ["Mod Cases"],
    security: userOrServiceSecurity,
    summary: "List moderation case actors",
    request: { params: modCaseIdParamsSchema },
    responses: { "200": listResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/mod-cases/{caseId}/actors",
    tags: ["Mod Cases"],
    security: userOrServiceSecurity,
    summary: "Add a moderation case actor",
    request: {
      params: modCaseIdParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(createModCaseActorBodySchema) },
      },
    },
    responses: { "201": successResponse("Moderation case actor added"), ...standardErrorResponses },
  });
}

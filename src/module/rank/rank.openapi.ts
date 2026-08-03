import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  jsonBody,
  listResponse,
  noContentResponse,
  standardErrorResponses,
  successResponse,
  userOrServiceSecurity,
} from "@/openapi/openapi.helpers.js";
import { rankResponseSchema } from "@/module/rank/rank.response-types.js";
import {
  createRankBodySchema,
  listRanksQuerySchema,
  rankKeyParamsSchema,
  updateRankBodySchema,
} from "@/module/rank/rank.schemas.js";

export function registerRankOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/ranks",
    tags: ["Ranks"],
    security: userOrServiceSecurity,
    summary: "List ranks",
    operationId: "listRanks",
    request: { query: listRanksQuerySchema },
    responses: { "200": listResponse(rankResponseSchema), ...standardErrorResponses },
  });
  registry.registerPath({
    method: "get",
    path: "/ranks/{rankKey}",
    tags: ["Ranks"],
    security: userOrServiceSecurity,
    summary: "Get a rank",
    operationId: "getRank",
    request: { params: rankKeyParamsSchema },
    responses: { "200": successResponse(rankResponseSchema), ...standardErrorResponses },
  });
  registry.registerPath({
    method: "post",
    path: "/ranks",
    tags: ["Ranks"],
    security: userOrServiceSecurity,
    summary: "Create a rank",
    operationId: "createRank",
    request: {
      body: { required: true, content: { "application/json": jsonBody(createRankBodySchema) } },
    },
    responses: { "201": successResponse(rankResponseSchema), ...standardErrorResponses },
  });
  registry.registerPath({
    method: "patch",
    path: "/ranks/{rankKey}",
    tags: ["Ranks"],
    security: userOrServiceSecurity,
    summary: "Update a rank",
    operationId: "updateRank",
    request: {
      params: rankKeyParamsSchema,
      body: { required: true, content: { "application/json": jsonBody(updateRankBodySchema) } },
    },
    responses: { "200": successResponse(rankResponseSchema), ...standardErrorResponses },
  });
  registry.registerPath({
    method: "delete",
    path: "/ranks/{rankKey}",
    tags: ["Ranks"],
    security: userOrServiceSecurity,
    summary: "Delete a rank",
    operationId: "deleteRank",
    request: { params: rankKeyParamsSchema },
    responses: { "204": noContentResponse, ...standardErrorResponses },
  });
}

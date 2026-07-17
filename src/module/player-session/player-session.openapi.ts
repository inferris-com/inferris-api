import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  listResponse,
  standardErrorResponses,
  successResponse,
  userOrServiceSecurity,
} from "../../openapi/openapi.helpers.js";
import { playerSessionResponseSchema } from "./player-session.response-types.js";
import {
  getPlayerSessionQuerySchema,
  listPlayerSessionsQuerySchema,
  networkSessionParamsSchema,
} from "./player-session.schemas.js";

export function registerPlayerSessionOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/network-sessions",
    tags: ["Network Sessions"],
    security: userOrServiceSecurity,
    summary: "List Minecraft network sessions",
    operationId: "listNetworkSessions",
    request: { query: listPlayerSessionsQuerySchema },
    responses: { "200": listResponse(playerSessionResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/network-sessions/{networkSessionId}",
    tags: ["Network Sessions"],
    security: userOrServiceSecurity,
    summary: "Get a Minecraft network session",
    operationId: "getNetworkSession",
    request: { params: networkSessionParamsSchema, query: getPlayerSessionQuerySchema },
    responses: { "200": successResponse(playerSessionResponseSchema), ...standardErrorResponses },
  });
}

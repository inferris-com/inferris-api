import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  listResponse,
  standardErrorResponses,
  successResponse,
  userOrServiceSecurity,
} from "../../openapi/openapi.helpers.js";
import { playerSessionResponseSchema } from "./player-session.response-types.js";
import {
  listPlayerSessionsQuerySchema,
  playerSessionParamsSchema,
} from "./player-session.schemas.js";

export function registerPlayerSessionOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/player-sessions",
    tags: ["Player Sessions"],
    security: userOrServiceSecurity,
    summary: "List player sessions",
    operationId: "listPlayerSessions",
    request: { query: listPlayerSessionsQuerySchema },
    responses: { "200": listResponse(playerSessionResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/player-sessions/live",
    tags: ["Player Sessions"],
    security: userOrServiceSecurity,
    summary: "List live player sessions",
    operationId: "listLivePlayerSessions",
    request: { query: listPlayerSessionsQuerySchema.omit({ state: true }) },
    responses: { "200": listResponse(playerSessionResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/player-sessions/{sessionId}",
    tags: ["Player Sessions"],
    security: userOrServiceSecurity,
    summary: "Get a player session",
    operationId: "getPlayerSession",
    request: { params: playerSessionParamsSchema },
    responses: { "200": successResponse(playerSessionResponseSchema), ...standardErrorResponses },
  });
}

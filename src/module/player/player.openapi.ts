import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  actingActorHeaderSchema,
  userOrServiceSecurity,
  jsonBody,
  listResponse,
  noContentResponse,
  standardErrorResponses,
  successResponse,
} from "../../openapi/openapi.helpers.js";
import {
  createPlayerBadgeAssignmentBodySchema,
  createPlayerBodySchema,
  decodePlayerFlagsQuerySchema,
  deletePlayerQuerySchema,
  encodePlayerFlagsQuerySchema,
  listPlayerFlagDefinitionsQuerySchema,
  listPlayersQuerySchema,
  playerBadgeAssignmentParamsSchema,
  playerIdParamsSchema,
  playerRankAssignmentParamsSchema,
  replacePlayerRankAssignmentBodySchema,
  updatePlayerBodySchema,
  updatePlayerProfileBodySchema,
} from "./player.schemas.js";

export function registerPlayerOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/players",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "List players",
    request: { query: listPlayersQuerySchema },
    responses: { "200": listResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/players/flags",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "List player flag definitions",
    request: { query: listPlayerFlagDefinitionsQuerySchema },
    responses: { "200": listResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/players/flags/encode",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "Encode player flags",
    request: { query: encodePlayerFlagsQuerySchema },
    responses: { "200": successResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/players/flags/decode",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "Decode player flags",
    request: { query: decodePlayerFlagsQuerySchema },
    responses: { "200": successResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/players/{playerId}",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "Get a player",
    request: { params: playerIdParamsSchema },
    responses: { "200": successResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/players/{playerId}/profile",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "Get a player profile",
    request: { params: playerIdParamsSchema },
    responses: { "200": successResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/players/{playerId}/badges",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "List player badge assignments",
    request: { params: playerIdParamsSchema },
    responses: { "200": listResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/players",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "Create a player",
    request: {
      body: { required: true, content: { "application/json": jsonBody(createPlayerBodySchema) } },
    },
    responses: { "201": successResponse("Player created"), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/players/{playerId}/badges",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "Assign a player badge",
    request: {
      params: playerIdParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(createPlayerBadgeAssignmentBodySchema) },
      },
    },
    responses: { "201": successResponse("Badge assigned"), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "put",
    path: "/players/{playerId}/ranks/{groupKey}/{rankKey}",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "Replace a player rank assignment",
    request: {
      headers: actingActorHeaderSchema,
      params: playerRankAssignmentParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(replacePlayerRankAssignmentBodySchema) },
      },
    },
    responses: { "200": successResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "patch",
    path: "/players/{playerId}",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "Update a player",
    request: {
      params: playerIdParamsSchema,
      body: { required: true, content: { "application/json": jsonBody(updatePlayerBodySchema) } },
    },
    responses: { "200": successResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "patch",
    path: "/players/{playerId}/profile",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "Update a player profile",
    request: {
      params: playerIdParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(updatePlayerProfileBodySchema) },
      },
    },
    responses: { "200": successResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "delete",
    path: "/players/{playerId}",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "Delete a player",
    request: { params: playerIdParamsSchema, query: deletePlayerQuerySchema },
    responses: { "204": noContentResponse, ...standardErrorResponses },
  });

  registry.registerPath({
    method: "delete",
    path: "/players/{playerId}/ranks/{groupKey}/{rankKey}",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "Delete a player rank assignment",
    request: { params: playerRankAssignmentParamsSchema },
    responses: { "204": noContentResponse, ...standardErrorResponses },
  });

  registry.registerPath({
    method: "delete",
    path: "/players/{playerId}/badges/{badgeId}",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "Delete a player badge assignment",
    request: { params: playerBadgeAssignmentParamsSchema },
    responses: { "204": noContentResponse, ...standardErrorResponses },
  });
}

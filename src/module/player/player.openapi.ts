import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  userOrServiceSecurity,
  jsonBody,
  listResponse,
  noContentResponse,
  standardErrorResponses,
  successResponse,
} from "@/openapi/openapi.helpers.js";
import {
  playerBadgeAssignmentResponseSchema,
  playerFlagBitmaskResponseSchema,
  playerFlagDefinitionResponseSchema,
  playerNicknameResponseSchema,
  playerProfileResponseSchema,
  playerRankAssignmentResponseSchema,
  playerResponseSchema,
  playerSearchResultResponseSchema,
  playerSummaryResponseSchema,
} from "@/module/player/player.response.types.js";
import {
  assignPlayerNicknameBodySchema,
  createPlayerBadgeAssignmentBodySchema,
  createPlayerBodySchema,
  decodePlayerFlagsQuerySchema,
  deletePlayerQuerySchema,
  encodePlayerFlagsQuerySchema,
  listPlayerFlagDefinitionsQuerySchema,
  listPlayersQuerySchema,
  playerBadgeAssignmentParamsSchema,
  playerIdParamsSchema,
  playerMojangIdParamsSchema,
  playerRankAssignmentParamsSchema,
  replacePlayerRankAssignmentBodySchema,
  searchPlayersQuerySchema,
  updatePlayerBodySchema,
  updatePlayerProfileBodySchema,
} from "@/module/player/player.schemas.js";

export function registerPlayerOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/players",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "List players",
    operationId: "listPlayers",
    request: { query: listPlayersQuerySchema },
    responses: { "200": listResponse(playerSummaryResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/players/search",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "Search players by username",
    operationId: "searchPlayers",
    request: { query: searchPlayersQuerySchema },
    responses: {
      "200": listResponse(playerSearchResultResponseSchema),
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/players/flags",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "List player flag definitions",
    operationId: "listPlayerFlagDefinitions",
    request: { query: listPlayerFlagDefinitionsQuerySchema },
    responses: {
      "200": listResponse(playerFlagDefinitionResponseSchema),
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/players/flags/encode",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "Encode player flags",
    operationId: "encodePlayerFlags",
    request: { query: encodePlayerFlagsQuerySchema },
    responses: {
      "200": successResponse(playerFlagBitmaskResponseSchema),
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/players/flags/decode",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "Decode player flags",
    operationId: "decodePlayerFlags",
    request: { query: decodePlayerFlagsQuerySchema },
    responses: {
      "200": successResponse(playerFlagBitmaskResponseSchema),
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/players/by-mojang/{mojangId}",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "Get a player by Mojang UUID",
    operationId: "getPlayerByMojangUuid",
    request: { params: playerMojangIdParamsSchema },
    responses: { "200": successResponse(playerResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/players/{playerId}",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "Get a player",
    operationId: "getPlayer",
    request: { params: playerIdParamsSchema },
    responses: { "200": successResponse(playerResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/players/{playerId}/profile",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "Get a player profile",
    operationId: "getPlayerProfile",
    request: { params: playerIdParamsSchema },
    responses: { "200": successResponse(playerProfileResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/players/{playerId}/badges",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "List player badge assignments",
    operationId: "listPlayerBadgeAssignments",
    request: { params: playerIdParamsSchema },
    responses: {
      "200": listResponse(playerBadgeAssignmentResponseSchema),
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/players/{playerId}/nicknames",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "List player nickname history",
    operationId: "listPlayerNicknameHistory",
    request: { params: playerIdParamsSchema },
    responses: { "200": listResponse(playerNicknameResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/players",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "Create a player",
    operationId: "createPlayer",
    request: {
      body: { required: true, content: { "application/json": jsonBody(createPlayerBodySchema) } },
    },
    responses: {
      "201": successResponse(playerResponseSchema, "Player created"),
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/players/{playerId}/badges",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "Assign a player badge",
    operationId: "assignPlayerBadge",
    request: {
      params: playerIdParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(createPlayerBadgeAssignmentBodySchema) },
      },
    },
    responses: {
      "201": successResponse(playerBadgeAssignmentResponseSchema, "Badge assigned"),
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/players/{playerId}/nicknames",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "Assign a player nickname",
    operationId: "assignPlayerNickname",
    request: {
      params: playerIdParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(assignPlayerNicknameBodySchema) },
      },
    },
    responses: {
      "201": successResponse(playerNicknameResponseSchema, "Nickname assigned"),
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "put",
    path: "/players/{playerId}/ranks/{groupKey}/{rankKey}",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "Replace a player rank assignment",
    operationId: "replacePlayerRankAssignment",
    request: {
      params: playerRankAssignmentParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(replacePlayerRankAssignmentBodySchema) },
      },
    },
    responses: {
      "200": successResponse(playerRankAssignmentResponseSchema),
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/players/{playerId}",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "Update a player",
    operationId: "updatePlayer",
    request: {
      params: playerIdParamsSchema,
      body: { required: true, content: { "application/json": jsonBody(updatePlayerBodySchema) } },
    },
    responses: { "200": successResponse(playerResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "patch",
    path: "/players/{playerId}/profile",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "Update a player profile",
    operationId: "updatePlayerProfile",
    request: {
      params: playerIdParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(updatePlayerProfileBodySchema) },
      },
    },
    responses: { "200": successResponse(playerProfileResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "delete",
    path: "/players/{playerId}",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "Delete a player",
    operationId: "deletePlayer",
    request: { params: playerIdParamsSchema, query: deletePlayerQuerySchema },
    responses: { "204": noContentResponse, ...standardErrorResponses },
  });

  registry.registerPath({
    method: "delete",
    path: "/players/{playerId}/ranks/{groupKey}/{rankKey}",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "Delete a player rank assignment",
    operationId: "deletePlayerRankAssignment",
    request: { params: playerRankAssignmentParamsSchema },
    responses: { "204": noContentResponse, ...standardErrorResponses },
  });

  registry.registerPath({
    method: "delete",
    path: "/players/{playerId}/badges/{badgeId}",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "Delete a player badge assignment",
    operationId: "deletePlayerBadgeAssignment",
    request: { params: playerBadgeAssignmentParamsSchema },
    responses: { "204": noContentResponse, ...standardErrorResponses },
  });

  registry.registerPath({
    method: "delete",
    path: "/players/{playerId}/nicknames/active",
    tags: ["Players"],
    security: userOrServiceSecurity,
    summary: "Revoke the active player nickname",
    operationId: "revokeActivePlayerNickname",
    request: { params: playerIdParamsSchema },
    responses: {
      "200": successResponse(playerNicknameResponseSchema, "Nickname revoked"),
      ...standardErrorResponses,
    },
  });
}

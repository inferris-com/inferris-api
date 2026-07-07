import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  userOrServiceSecurity,
  jsonBody,
  listResponse,
  noContentResponse,
  standardErrorResponses,
  successResponse,
} from "../../openapi/openapi.helpers.js";
import { listEnvelopeSchema, successEnvelopeSchema } from "../../openapi/envelope.schemas.js";
import {
  accessResponseSchema,
  lockdownResponseSchema,
  playerSessionResponseSchema,
  serverHeartbeatResponseSchema,
  serverResponseSchema,
} from "./server.response.types.js";
import {
  createLockdownBodySchema,
  createPlayerSessionBodySchema,
  createServerBodySchema,
  replaceServerAccessBodySchema,
  serverHeartbeatBodySchema,
  serverIdParamsSchema,
  serverNameParamsSchema,
  serverPlayerSessionParamsSchema,
  updateLockdownBodySchema,
  updateServerBodySchema,
} from "./server.schemas.js";

const serverEnvelopeSchema = successEnvelopeSchema("ServerEnvelope", serverResponseSchema);
const serverListEnvelopeSchema = listEnvelopeSchema("ServerListEnvelope", serverResponseSchema);
const accessEnvelopeSchema = successEnvelopeSchema("AccessEnvelope", accessResponseSchema);
const lockdownEnvelopeSchema = successEnvelopeSchema("LockdownEnvelope", lockdownResponseSchema);
const playerSessionEnvelopeSchema = successEnvelopeSchema(
  "PlayerSessionEnvelope",
  playerSessionResponseSchema,
);
const serverHeartbeatEnvelopeSchema = successEnvelopeSchema(
  "ServerHeartbeatEnvelope",
  serverHeartbeatResponseSchema,
);

export function registerServerOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/servers",
    tags: ["Servers"],
    security: userOrServiceSecurity,
    summary: "List servers",
    operationId: "listServers",
    responses: { "200": listResponse(serverListEnvelopeSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/servers",
    tags: ["Servers"],
    security: userOrServiceSecurity,
    summary: "Create a server",
    operationId: "createServer",
    request: {
      body: { required: true, content: { "application/json": jsonBody(createServerBodySchema) } },
    },
    responses: { "200": successResponse(serverEnvelopeSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/servers/register",
    tags: ["Servers"],
    security: userOrServiceSecurity,
    summary: "Register or update a server by stable name",
    operationId: "registerOrUpdateServerByStableName",
    request: {
      body: { required: true, content: { "application/json": jsonBody(createServerBodySchema) } },
    },
    responses: { "200": successResponse(serverEnvelopeSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/servers/{serverId}/lockdown",
    tags: ["Servers"],
    security: userOrServiceSecurity,
    summary: "Create a server lockdown",
    operationId: "createServerLockdown",
    request: {
      params: serverIdParamsSchema,
      body: { required: true, content: { "application/json": jsonBody(createLockdownBodySchema) } },
    },
    responses: { "200": successResponse(lockdownEnvelopeSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/servers/{serverId}/player-sessions",
    tags: ["Servers"],
    security: userOrServiceSecurity,
    summary: "Start a Minecraft player session",
    operationId: "startMinecraftPlayerSession",
    request: {
      params: serverIdParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(createPlayerSessionBodySchema) },
      },
    },
    responses: {
      "201": successResponse(playerSessionEnvelopeSchema, "Player session started"),
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/servers/{serverId}/heartbeat",
    tags: ["Servers"],
    security: userOrServiceSecurity,
    summary: "Refresh server heartbeat and online Minecraft sessions",
    operationId: "refreshServerHeartbeatAndOnlineMinecraftSessions",
    request: {
      params: serverIdParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(serverHeartbeatBodySchema) },
      },
    },
    responses: { "200": successResponse(serverHeartbeatEnvelopeSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "put",
    path: "/servers/{serverId}/access",
    tags: ["Servers"],
    security: userOrServiceSecurity,
    summary: "Replace a server access policy",
    operationId: "replaceServerAccessPolicy",
    request: {
      params: serverIdParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(replaceServerAccessBodySchema) },
      },
    },
    responses: { "200": successResponse(accessEnvelopeSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "patch",
    path: "/servers/{serverId}",
    tags: ["Servers"],
    security: userOrServiceSecurity,
    summary: "Update a server",
    operationId: "updateServer",
    request: {
      params: serverIdParamsSchema,
      body: { required: true, content: { "application/json": jsonBody(updateServerBodySchema) } },
    },
    responses: { "200": successResponse(serverEnvelopeSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "patch",
    path: "/servers/{serverId}/lockdown",
    tags: ["Servers"],
    security: userOrServiceSecurity,
    summary: "Update a server lockdown",
    operationId: "updateServerLockdown",
    request: {
      params: serverIdParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(updateLockdownBodySchema) },
      },
    },
    responses: { "200": successResponse(lockdownEnvelopeSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/servers/lockdowns/global/active",
    tags: ["Servers"],
    security: userOrServiceSecurity,
    summary: "Get the active global server lockdown",
    operationId: "getActiveGlobalServerLockdown",
    responses: { "200": successResponse(lockdownEnvelopeSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/servers/{serverId}",
    tags: ["Servers"],
    security: userOrServiceSecurity,
    summary: "Get a server",
    operationId: "getServer",
    request: { params: serverIdParamsSchema },
    responses: { "200": successResponse(serverEnvelopeSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/servers/{serverId}/access",
    tags: ["Servers"],
    security: userOrServiceSecurity,
    summary: "Get a server access policy",
    operationId: "getServerAccessPolicy",
    request: { params: serverIdParamsSchema },
    responses: { "200": successResponse(accessEnvelopeSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/servers/{serverId}/lockdown",
    tags: ["Servers"],
    security: userOrServiceSecurity,
    summary: "Get a server lockdown",
    operationId: "getServerLockdown",
    request: { params: serverIdParamsSchema },
    responses: { "200": successResponse(lockdownEnvelopeSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/servers/by-name/{serverName}",
    tags: ["Servers"],
    security: userOrServiceSecurity,
    summary: "Get a server by stable name",
    operationId: "getServerByStableName",
    request: { params: serverNameParamsSchema },
    responses: { "200": successResponse(serverEnvelopeSchema), ...standardErrorResponses },
  });

  for (const [path, summary, operationId] of [
    ["/servers/{serverId}", "Delete a server", "deleteServer"],
    [
      "/servers/{serverId}/player-sessions/{mojangId}",
      "End a Minecraft player session",
      "endMinecraftPlayerSession",
    ],
    ["/servers/{serverId}/lockdown", "Delete a server lockdown", "deleteServerLockdown"],
    ["/servers/{serverId}/access", "Delete a server access policy", "deleteServerAccessPolicy"],
  ] as const) {
    registry.registerPath({
      method: "delete",
      path,
      tags: ["Servers"],
      security: userOrServiceSecurity,
      summary,
      operationId,
      request: {
        params: path.includes("player-sessions")
          ? serverPlayerSessionParamsSchema
          : serverIdParamsSchema,
      },
      responses: { "204": noContentResponse, ...standardErrorResponses },
    });
  }
}

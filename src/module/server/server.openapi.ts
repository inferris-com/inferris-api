import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  userOrServiceSecurity,
  jsonBody,
  listResponse,
  noContentResponse,
  standardErrorResponses,
  successResponse,
} from "../../openapi/openapi.helpers.js";
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

export function registerServerOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/servers",
    tags: ["Servers"],
    security: userOrServiceSecurity,
    summary: "List servers",
    responses: { "200": listResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/servers",
    tags: ["Servers"],
    security: userOrServiceSecurity,
    summary: "Create a server",
    request: {
      body: { required: true, content: { "application/json": jsonBody(createServerBodySchema) } },
    },
    responses: { "200": successResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/servers/register",
    tags: ["Servers"],
    security: userOrServiceSecurity,
    summary: "Register or update a server by stable name",
    request: {
      body: { required: true, content: { "application/json": jsonBody(createServerBodySchema) } },
    },
    responses: { "200": successResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/servers/{serverId}/lockdown",
    tags: ["Servers"],
    security: userOrServiceSecurity,
    summary: "Create a server lockdown",
    request: {
      params: serverIdParamsSchema,
      body: { required: true, content: { "application/json": jsonBody(createLockdownBodySchema) } },
    },
    responses: { "200": successResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/servers/{serverId}/player-sessions",
    tags: ["Servers"],
    security: userOrServiceSecurity,
    summary: "Start a Minecraft player session",
    request: {
      params: serverIdParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(createPlayerSessionBodySchema) },
      },
    },
    responses: { "201": successResponse("Player session started"), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/servers/{serverId}/heartbeat",
    tags: ["Servers"],
    security: userOrServiceSecurity,
    summary: "Refresh server heartbeat and online Minecraft sessions",
    request: {
      params: serverIdParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(serverHeartbeatBodySchema) },
      },
    },
    responses: { "200": successResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "put",
    path: "/servers/{serverId}/access",
    tags: ["Servers"],
    security: userOrServiceSecurity,
    summary: "Replace a server access policy",
    request: {
      params: serverIdParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(replaceServerAccessBodySchema) },
      },
    },
    responses: { "200": successResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "patch",
    path: "/servers/{serverId}",
    tags: ["Servers"],
    security: userOrServiceSecurity,
    summary: "Update a server",
    request: {
      params: serverIdParamsSchema,
      body: { required: true, content: { "application/json": jsonBody(updateServerBodySchema) } },
    },
    responses: { "200": successResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "patch",
    path: "/servers/{serverId}/lockdown",
    tags: ["Servers"],
    security: userOrServiceSecurity,
    summary: "Update a server lockdown",
    request: {
      params: serverIdParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(updateLockdownBodySchema) },
      },
    },
    responses: { "200": successResponse(), ...standardErrorResponses },
  });

  for (const [path, summary] of [
    ["/servers/lockdowns/global/active", "Get the active global server lockdown"],
    ["/servers/{serverId}", "Get a server"],
    ["/servers/{serverId}/access", "Get a server access policy"],
    ["/servers/{serverId}/lockdown", "Get a server lockdown"],
  ] as const) {
    registry.registerPath({
      method: "get",
      path,
      tags: ["Servers"],
      security: userOrServiceSecurity,
      summary,
      request: { params: serverIdParamsSchema },
      responses: { "200": successResponse(), ...standardErrorResponses },
    });
  }

  registry.registerPath({
    method: "get",
    path: "/servers/by-name/{serverName}",
    tags: ["Servers"],
    security: userOrServiceSecurity,
    summary: "Get a server by stable name",
    request: { params: serverNameParamsSchema },
    responses: { "200": successResponse(), ...standardErrorResponses },
  });

  for (const [path, summary] of [
    ["/servers/{serverId}", "Delete a server"],
    ["/servers/{serverId}/player-sessions/{mojangId}", "End a Minecraft player session"],
    ["/servers/{serverId}/lockdown", "Delete a server lockdown"],
    ["/servers/{serverId}/access", "Delete a server access policy"],
  ] as const) {
    registry.registerPath({
      method: "delete",
      path,
      tags: ["Servers"],
      security: userOrServiceSecurity,
      summary,
      request: {
        params: path.includes("player-sessions")
          ? serverPlayerSessionParamsSchema
          : serverIdParamsSchema,
      },
      responses: { "204": noContentResponse, ...standardErrorResponses },
    });
  }
}

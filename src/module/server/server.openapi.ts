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
  accessResponseSchema,
  lockdownResponseSchema,
  serverResponseSchema,
} from "@/module/server/server.response.types.js";
import {
  createLockdownBodySchema,
  createServerBodySchema,
  replaceServerAccessBodySchema,
  serverIdParamsSchema,
  serverNameParamsSchema,
  updateLockdownBodySchema,
  updateServerBodySchema,
} from "@/module/server/server.schemas.js";

export function registerServerOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/servers",
    tags: ["Servers"],
    security: userOrServiceSecurity,
    summary: "List servers",
    operationId: "listServers",
    responses: { "200": listResponse(serverResponseSchema), ...standardErrorResponses },
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
    responses: { "200": successResponse(serverResponseSchema), ...standardErrorResponses },
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
    responses: { "200": successResponse(serverResponseSchema), ...standardErrorResponses },
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
    responses: { "200": successResponse(lockdownResponseSchema), ...standardErrorResponses },
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
    responses: { "200": successResponse(accessResponseSchema), ...standardErrorResponses },
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
    responses: { "200": successResponse(serverResponseSchema), ...standardErrorResponses },
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
    responses: { "200": successResponse(lockdownResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/servers/lockdowns/global/active",
    tags: ["Servers"],
    security: userOrServiceSecurity,
    summary: "Get the active global server lockdown",
    operationId: "getActiveGlobalServerLockdown",
    responses: { "200": successResponse(lockdownResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/servers/{serverId}",
    tags: ["Servers"],
    security: userOrServiceSecurity,
    summary: "Get a server",
    operationId: "getServer",
    request: { params: serverIdParamsSchema },
    responses: { "200": successResponse(serverResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/servers/{serverId}/access",
    tags: ["Servers"],
    security: userOrServiceSecurity,
    summary: "Get a server access policy",
    operationId: "getServerAccessPolicy",
    request: { params: serverIdParamsSchema },
    responses: { "200": successResponse(accessResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/servers/{serverId}/lockdown",
    tags: ["Servers"],
    security: userOrServiceSecurity,
    summary: "Get a server lockdown",
    operationId: "getServerLockdown",
    request: { params: serverIdParamsSchema },
    responses: { "200": successResponse(lockdownResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/servers/by-name/{serverName}",
    tags: ["Servers"],
    security: userOrServiceSecurity,
    summary: "Get a server by stable name",
    operationId: "getServerByStableName",
    request: { params: serverNameParamsSchema },
    responses: { "200": successResponse(serverResponseSchema), ...standardErrorResponses },
  });

  for (const [path, summary, operationId] of [
    ["/servers/{serverId}", "Delete a server", "deleteServer"],
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
      request: { params: serverIdParamsSchema },
      responses: { "204": noContentResponse, ...standardErrorResponses },
    });
  }
}

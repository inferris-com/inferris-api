import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  bearerSecurity,
  jsonBody,
  noContentResponse,
  standardErrorResponses,
  successResponse,
} from "../../openapi/openapi.helpers.js";
import {
  createLockdownBodySchema,
  createServerBodySchema,
  replaceServerAccessBodySchema,
  serverIdParamsSchema,
  updateLockdownBodySchema,
  updateServerBodySchema,
} from "./server.schemas.js";

export function registerServerOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "post",
    path: "/servers",
    tags: ["Servers"],
    security: bearerSecurity,
    summary: "Create a server",
    request: {
      body: { required: true, content: { "application/json": jsonBody(createServerBodySchema) } },
    },
    responses: { "200": successResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "post",
    path: "/servers/{serverId}/lockdown",
    tags: ["Servers"],
    security: bearerSecurity,
    summary: "Create a server lockdown",
    request: {
      params: serverIdParamsSchema,
      body: { required: true, content: { "application/json": jsonBody(createLockdownBodySchema) } },
    },
    responses: { "200": successResponse(), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "put",
    path: "/servers/{serverId}/access",
    tags: ["Servers"],
    security: bearerSecurity,
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
    security: bearerSecurity,
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
    security: bearerSecurity,
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
    ["/servers/{serverId}", "Get a server"],
    ["/servers/{serverId}/access", "Get a server access policy"],
    ["/servers/{serverId}/lockdown", "Get a server lockdown"],
  ] as const) {
    registry.registerPath({
      method: "get",
      path,
      tags: ["Servers"],
      security: bearerSecurity,
      summary,
      request: { params: serverIdParamsSchema },
      responses: { "200": successResponse(), ...standardErrorResponses },
    });
  }

  for (const [path, summary] of [
    ["/servers/{serverId}", "Delete a server"],
    ["/servers/{serverId}/lockdown", "Delete a server lockdown"],
    ["/servers/{serverId}/access", "Delete a server access policy"],
  ] as const) {
    registry.registerPath({
      method: "delete",
      path,
      tags: ["Servers"],
      security: bearerSecurity,
      summary,
      request: { params: serverIdParamsSchema },
      responses: { "204": noContentResponse, ...standardErrorResponses },
    });
  }
}

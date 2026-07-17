import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  jsonBody,
  standardErrorResponses,
  successResponse,
  userOrServiceSecurity,
} from "../../openapi/openapi.helpers.js";
import {
  registerServerInstanceResponseSchema,
  serverInstanceEventResponseSchema,
  serverInstanceHeartbeatResponseSchema,
  serverInstanceMetricsResponseSchema,
  serverInstancePresenceResponseSchema,
  serverInstanceResponseSchema,
} from "./server-instance.response-types.js";
import {
  registerServerInstanceBodySchema,
  serverInstanceEventBodySchema,
  serverInstanceHeartbeatBodySchema,
  serverInstanceIdParamsSchema,
  serverInstanceMetricsBodySchema,
  serverInstancePresenceBodySchema,
} from "./server-instance.schemas.js";

const serverInstanceSecurity = [{ bearerAuth: [] }];

export function registerServerInstanceOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "post",
    path: "/server-instances/register",
    tags: ["Server Instances"],
    security: userOrServiceSecurity,
    summary: "Register a running server instance",
    operationId: "registerServerInstance",
    request: {
      body: {
        required: true,
        content: { "application/json": jsonBody(registerServerInstanceBodySchema) },
      },
    },
    responses: {
      "201": successResponse(registerServerInstanceResponseSchema, "Server instance registered"),
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/server-instances/{serverInstanceId}",
    tags: ["Server Instances"],
    security: userOrServiceSecurity,
    summary: "Get a server instance",
    operationId: "getServerInstance",
    request: { params: serverInstanceIdParamsSchema },
    responses: { "200": successResponse(serverInstanceResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "put",
    path: "/server-instances/{serverInstanceId}/heartbeat",
    tags: ["Server Instances"],
    security: serverInstanceSecurity,
    summary: "Refresh server instance heartbeat",
    operationId: "refreshServerInstanceHeartbeat",
    request: {
      params: serverInstanceIdParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(serverInstanceHeartbeatBodySchema) },
      },
    },
    responses: {
      "200": successResponse(serverInstanceHeartbeatResponseSchema),
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/server-instances/{serverInstanceId}/metrics",
    tags: ["Server Instances"],
    security: serverInstanceSecurity,
    summary: "Record server instance metrics",
    operationId: "recordServerInstanceMetrics",
    request: {
      params: serverInstanceIdParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(serverInstanceMetricsBodySchema) },
      },
    },
    responses: {
      "201": successResponse(serverInstanceMetricsResponseSchema, "Metrics recorded"),
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "put",
    path: "/server-instances/{serverInstanceId}/presence",
    tags: ["Server Instances"],
    security: serverInstanceSecurity,
    summary: "Reconcile observed server instance presence",
    operationId: "reconcileServerInstancePresence",
    request: {
      params: serverInstanceIdParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(serverInstancePresenceBodySchema) },
      },
    },
    responses: {
      "200": successResponse(serverInstancePresenceResponseSchema),
      ...standardErrorResponses,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/server-instances/{serverInstanceId}/events",
    tags: ["Server Instances"],
    security: serverInstanceSecurity,
    summary: "Record an ordered server instance event",
    operationId: "recordServerInstanceEvent",
    request: {
      params: serverInstanceIdParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(serverInstanceEventBodySchema) },
      },
    },
    responses: {
      "201": successResponse(serverInstanceEventResponseSchema, "Event recorded"),
      ...standardErrorResponses,
      "409": {
        description: "Event sequence conflict",
      },
    },
  });
}

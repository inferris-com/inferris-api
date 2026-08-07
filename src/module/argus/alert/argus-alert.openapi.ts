import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  jsonBody,
  listResponse,
  standardErrorResponses,
  successResponse,
  userOrServiceSecurity,
} from "@/openapi/openapi.helpers.js";
import { argusAlertResponseSchema } from "@/module/argus/alert/argus-alert.response-types.js";
import {
  argusAlertParamsSchema,
  createArgusAlertBodySchema,
  listArgusAlertsQuerySchema,
  updateArgusAlertBodySchema,
} from "@/module/argus/alert/argus-alert.schemas.js";

export function registerArgusAlertOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/argus-alerts",
    tags: ["Argus Alerts"],
    security: userOrServiceSecurity,
    summary: "List site-wide Argus alerts",
    operationId: "listArgusAlerts",
    request: { query: listArgusAlertsQuerySchema },
    responses: { "200": listResponse(argusAlertResponseSchema), ...standardErrorResponses },
  });
  registry.registerPath({
    method: "get",
    path: "/argus-alerts/{alertId}",
    tags: ["Argus Alerts"],
    security: userOrServiceSecurity,
    summary: "Get a site-wide Argus alert",
    operationId: "getArgusAlert",
    request: { params: argusAlertParamsSchema },
    responses: { "200": successResponse(argusAlertResponseSchema), ...standardErrorResponses },
  });
  registry.registerPath({
    method: "post",
    path: "/argus-alerts",
    tags: ["Argus Alerts"],
    security: userOrServiceSecurity,
    summary: "Create a site-wide Argus alert",
    operationId: "createArgusAlert",
    request: {
      body: {
        required: true,
        content: { "application/json": jsonBody(createArgusAlertBodySchema) },
      },
    },
    responses: { "201": successResponse(argusAlertResponseSchema), ...standardErrorResponses },
  });
  registry.registerPath({
    method: "patch",
    path: "/argus-alerts/{alertId}",
    tags: ["Argus Alerts"],
    security: userOrServiceSecurity,
    summary: "Update a site-wide Argus alert",
    operationId: "updateArgusAlert",
    request: {
      params: argusAlertParamsSchema,
      body: {
        required: true,
        content: { "application/json": jsonBody(updateArgusAlertBodySchema) },
      },
    },
    responses: { "200": successResponse(argusAlertResponseSchema), ...standardErrorResponses },
  });
  registry.registerPath({
    method: "delete",
    path: "/argus-alerts/{alertId}",
    tags: ["Argus Alerts"],
    security: userOrServiceSecurity,
    summary: "Deactivate a site-wide Argus alert",
    operationId: "deactivateArgusAlert",
    request: { params: argusAlertParamsSchema },
    responses: { "200": successResponse(argusAlertResponseSchema), ...standardErrorResponses },
  });
}

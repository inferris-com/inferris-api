import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  standardErrorResponses,
  successResponse,
  userOrServiceSecurity,
} from "../../openapi/openapi.helpers.js";
import {
  metricsOverviewResponseSchema,
  serverMetricsResponseSchema,
} from "./metrics.response-types.js";
import { metricsQuerySchema, serverMetricsParamsSchema } from "./metrics.schemas.js";

export function registerMetricsOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/metrics/overview",
    tags: ["Metrics"],
    security: userOrServiceSecurity,
    summary: "Get network metrics overview",
    operationId: "getMetricsOverview",
    request: { query: metricsQuerySchema },
    responses: { "200": successResponse(metricsOverviewResponseSchema), ...standardErrorResponses },
  });

  registry.registerPath({
    method: "get",
    path: "/metrics/servers/{serverId}",
    tags: ["Metrics"],
    security: userOrServiceSecurity,
    summary: "Get server metrics",
    operationId: "getServerMetrics",
    request: { params: serverMetricsParamsSchema, query: metricsQuerySchema },
    responses: { "200": successResponse(serverMetricsResponseSchema), ...standardErrorResponses },
  });
}

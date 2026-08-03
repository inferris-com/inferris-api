import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import {
  listResponse,
  standardErrorResponses,
  successResponse,
  userOrServiceSecurity,
} from "@/openapi/openapi.helpers.js";
import { auditLogResponseSchema } from "@/module/audit-log/audit-log.response-types.js";
import {
  auditLogParamsSchema,
  listAuditLogsQuerySchema,
} from "@/module/audit-log/audit-log.schemas.js";

export function registerAuditLogOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/audit-logs",
    tags: ["Audit Logs"],
    security: userOrServiceSecurity,
    summary: "List audit logs",
    operationId: "listAuditLogs",
    request: { query: listAuditLogsQuerySchema },
    responses: { "200": listResponse(auditLogResponseSchema), ...standardErrorResponses },
  });
  registry.registerPath({
    method: "get",
    path: "/audit-logs/{auditLogId}",
    tags: ["Audit Logs"],
    security: userOrServiceSecurity,
    summary: "Get an audit log",
    operationId: "getAuditLog",
    request: { params: auditLogParamsSchema },
    responses: { "200": successResponse(auditLogResponseSchema), ...standardErrorResponses },
  });
}

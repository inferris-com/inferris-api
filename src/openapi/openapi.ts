import { OpenApiGeneratorV31, OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import { registerActorOpenApi } from "../module/actor/actor.openapi.js";
import { registerAccountOpenApi } from "../module/account/account.openapi.js";
import { registerArgusAlertOpenApi } from "../module/argus-alert/argus-alert.openapi.js";
import { registerArgusDmOpenApi } from "../module/argus-dm/argus-dm.openapi.js";
import { registerArgusUserOpenApi } from "../module/argus-user/argus-user.openapi.js";
import { registerAuthOpenApi } from "../module/auth/auth.openapi.js";
import { registerAuditLogOpenApi } from "../module/audit-log/audit-log.openapi.js";
import { registerBadgeOpenApi } from "../module/badge/badge.openapi.js";
import { registerChatMessageOpenApi } from "../module/chat-message/chat-message.openapi.js";
import { registerGroupOpenApi } from "../module/group/group.openapi.js";
import { registerMetricsOpenApi } from "../module/metrics/metrics.openapi.js";
import { registerModCaseOpenApi } from "../module/mod-case/mod-case.openapi.js";
import { registerPermissionOpenApi } from "../module/permission/permission.openapi.js";
import { registerPlayerSessionOpenApi } from "../module/player-session/player-session.openapi.js";
import { registerPlayerOpenApi } from "../module/player/player.openapi.js";
import { registerPunishmentOpenApi } from "../module/punishment/punishment.openapi.js";
import { registerRankOpenApi } from "../module/rank/rank.openapi.js";
import { registerReportOpenApi } from "../module/report/report.openapi.js";
import { registerServerInstanceOpenApi } from "../module/server-instance/server-instance.openapi.js";
import { registerServerOpenApi } from "../module/server/server.openapi.js";
import { registerStaffPrivilegeOpenApi } from "../module/staff-privilege/staff-privilege.openapi.js";
import { registerWatchlistOpenApi } from "../module/watchlist/watchlist.openapi.js";

const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "apiKeyAuth", {
  type: "apiKey",
  in: "header",
  name: "x-api-key",
});

registry.registerComponent("securitySchemes", "basicAuth", {
  type: "http",
  scheme: "basic",
});

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

registry.registerPath({
  method: "get",
  path: "/health",
  tags: ["System"],
  summary: "Check API health",
  operationId: "getHealth",
  responses: {
    "200": {
      description: "API is healthy",
    },
  },
});

registerAuthOpenApi(registry);
registerAccountOpenApi(registry);
registerActorOpenApi(registry);
registerArgusAlertOpenApi(registry);
registerArgusDmOpenApi(registry);
registerArgusUserOpenApi(registry);
registerAuditLogOpenApi(registry);
registerBadgeOpenApi(registry);
registerGroupOpenApi(registry);
registerPlayerOpenApi(registry);
registerPlayerSessionOpenApi(registry);
registerRankOpenApi(registry);
registerServerOpenApi(registry);
registerServerInstanceOpenApi(registry);
registerStaffPrivilegeOpenApi(registry);
registerPermissionOpenApi(registry);
registerPunishmentOpenApi(registry);
registerReportOpenApi(registry);
registerModCaseOpenApi(registry);
registerChatMessageOpenApi(registry);
registerWatchlistOpenApi(registry);
registerMetricsOpenApi(registry);

const generator = new OpenApiGeneratorV31(registry.definitions);

const generatedOpenApiDocument = generator.generateDocument({
  openapi: "3.1.0",
  info: {
    title: "Inferris API",
    version: "1.0.0",
    description: "REST API for the Inferris Minecraft network platform.",
  },
  servers: [{ url: "/" }],
});

stripServerInstanceEventTypeConsts(generatedOpenApiDocument as unknown as Record<string, unknown>);

export const openApiDocument = generatedOpenApiDocument;

function stripServerInstanceEventTypeConsts(document: Record<string, unknown>) {
  const schemas = getRecord(getRecord(document.components)?.schemas);
  if (schemas === undefined) {
    return;
  }

  for (const schemaName of [
    "NetworkSessionStartedEventRequest",
    "BackendConnectedEventRequest",
    "NetworkSessionEndedEventRequest",
    "ServerShuttingDownEventRequest",
    "ServerStoppedEventRequest",
  ]) {
    const schema = getRecord(schemas[schemaName]);
    const properties = getRecord(schema?.properties);
    const typeProperty = getRecord(properties?.type);
    if (typeProperty !== undefined) {
      delete typeProperty.const;
    }
  }
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}

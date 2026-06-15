import { OpenApiGeneratorV31, OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import { registerActorOpenApi } from "../module/actor/actor.openapi.js";
import { registerAuthOpenApi } from "../module/auth/auth.openapi.js";
import { registerChatMessageOpenApi } from "../module/chat-message/chat-message.openapi.js";
import { registerModCaseOpenApi } from "../module/mod-case/mod-case.openapi.js";
import { registerPermissionOpenApi } from "../module/permission/permission.openapi.js";
import { registerPlayerOpenApi } from "../module/player/player.openapi.js";
import { registerPunishmentOpenApi } from "../module/punishment/punishment.openapi.js";
import { registerReportOpenApi } from "../module/report/report.openapi.js";
import { registerServerOpenApi } from "../module/server/server.openapi.js";

const registry = new OpenAPIRegistry();

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
  responses: {
    "200": {
      description: "API is healthy",
    },
  },
});

registerAuthOpenApi(registry);
registerActorOpenApi(registry);
registerPlayerOpenApi(registry);
registerServerOpenApi(registry);
registerPermissionOpenApi(registry);
registerPunishmentOpenApi(registry);
registerReportOpenApi(registry);
registerModCaseOpenApi(registry);
registerChatMessageOpenApi(registry);

const generator = new OpenApiGeneratorV31(registry.definitions);

export const openApiDocument = generator.generateDocument({
  openapi: "3.1.0",
  info: {
    title: "Inferris API",
    version: "1.0.0",
    description: "REST API for the Inferris Minecraft network platform.",
  },
  servers: [{ url: "/" }],
});

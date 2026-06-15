import type { Express } from "express";

import { createActorRouter } from "../module/actor/actor.route.js";
import { createAuthRouter } from "../module/auth/auth.route.js";
import { createChatMessageRouter } from "../module/chat-message/chat-message.route.js";
import { createModCaseRouter } from "../module/mod-case/mod-case.route.js";
import { createPermissionRouter } from "../module/permission/permission.route.js";
import { createPlayerRouter } from "../module/player/player.route.js";
import { createPunishmentRouter } from "../module/punishment/punishment.route.js";
import { createReportRouter } from "../module/report/report.route.js";
import { createServerRouter } from "../module/server/server.route.js";
import type { AppDependencies } from "./app.dependencies.js";

export function registerAppRoutes(app: Express, dependencies: AppDependencies): void {
  const { authRepository, authenticateRequest, services } = dependencies;

  app.use("/auth", createAuthRouter(services.auth, authenticateRequest));
  app.use("/players", authenticateRequest, createPlayerRouter(services.player, authRepository));
  app.use("/actors", authenticateRequest, createActorRouter(services.actor, authRepository));
  app.use("/servers", authenticateRequest, createServerRouter(services.server, authRepository));
  app.use(
    "/permissions",
    authenticateRequest,
    createPermissionRouter(services.permission, authRepository),
  );
  app.use(
    "/punishments",
    authenticateRequest,
    createPunishmentRouter(services.punishment, authRepository),
  );
  app.use("/reports", authenticateRequest, createReportRouter(services.report, authRepository));
  app.use("/mod-cases", authenticateRequest, createModCaseRouter(services.modCase, authRepository));
  app.use(
    "/chat-messages",
    authenticateRequest,
    createChatMessageRouter(services.chatMessage, authRepository),
  );
}

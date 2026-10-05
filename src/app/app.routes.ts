import type { Express } from "express";

import { createAccountRouter } from "@/module/argus/account/account.route.js";
import { createActorRouter } from "@/module/actor/actor.route.js";
import { createArgusAlertRouter } from "@/module/argus/alert/argus-alert.route.js";
import { createArgusDmRouter } from "@/module/argus/direct-messages/argus-dm.route.js";
import { createArgusUserRouter } from "@/module/argus/argus-user/argus-user.route.js";
import { createAuthRouter } from "@/module/auth/auth.route.js";
import { createAuditLogRouter } from "@/module/audit-log/audit-log.route.js";
import { createBadgeRouter } from "@/module/badge/badge.route.js";
import { createChatMessageRouter } from "@/module/chat-message/chat-message.route.js";
import { createGroupRouter } from "@/module/group/group.route.js";
import { createMetricsRouter } from "@/module/metrics/metrics.route.js";
import { createModCaseRouter } from "@/module/mod-case/mod-case.route.js";
import { createPermissionRouter } from "@/module/permission/permission.route.js";
import { createPlayerSessionRouter } from "@/module/player-session/player-session.route.js";
import { createPlayerRouter } from "@/module/player/player.route.js";
import { createPunishmentRouter } from "@/module/punishment/punishment.route.js";
import { createRankRouter } from "@/module/rank/rank.route.js";
import { createReportRouter } from "@/module/report/report.route.js";
import { createServerInstanceRouter } from "@/module/server-instance/server-instance.route.js";
import { createServerRouter } from "@/module/server/server.route.js";
import { createStaffPrivilegeRouter } from "@/module/staff-privilege/staff-privilege.route.js";
import { createWatchlistRouter } from "@/module/watchlist/watchlist.route.js";
import type { AppDependencies } from "@/app/app.dependencies.js";

export function registerAppRoutes(app: Express, dependencies: AppDependencies): void {
  const { authRepository, authenticateRequest, services } = dependencies;

  app.use("/auth", createAuthRouter(services.auth, authenticateRequest));
  app.use("/account", authenticateRequest, createAccountRouter(services.account));
  app.use("/players", authenticateRequest, createPlayerRouter(services.player, authRepository));
  app.use("/groups", authenticateRequest, createGroupRouter(services.group, authRepository));
  app.use("/ranks", authenticateRequest, createRankRouter(services.rank, authRepository));
  app.use("/badges", authenticateRequest, createBadgeRouter(services.badge, authRepository));
  app.use(
    "/staff-privileges",
    authenticateRequest,
    createStaffPrivilegeRouter(services.staffPrivilege, authRepository),
  );
  app.use(
    "/argus-users",
    authenticateRequest,
    createArgusUserRouter(services.argusUser, authRepository),
  );
  app.use(
    "/argus-alerts",
    authenticateRequest,
    createArgusAlertRouter(services.argusAlert, authRepository),
  );
  app.use("/argus-dms", authenticateRequest, createArgusDmRouter(services.argusDm, authRepository));
  app.use(
    "/audit-logs",
    authenticateRequest,
    createAuditLogRouter(services.auditLog, authRepository),
  );
  app.use(
    "/network-sessions",
    authenticateRequest,
    createPlayerSessionRouter(services.playerSession, authRepository),
  );
  app.use("/actors", authenticateRequest, createActorRouter(services.actor, authRepository));
  app.use("/servers", authenticateRequest, createServerRouter(services.server, authRepository));
  app.use(
    "/server-instances",
    authenticateRequest,
    createServerInstanceRouter(services.serverInstance, authRepository),
  );
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
  app.use(
    "/watchlist",
    authenticateRequest,
    createWatchlistRouter(services.watchlist, authRepository),
  );
  app.use("/mod-cases", authenticateRequest, createModCaseRouter(services.modCase, authRepository));
  app.use(
    "/chat-messages",
    authenticateRequest,
    createChatMessageRouter(services.chatMessage, authRepository),
  );
  app.use("/metrics", authenticateRequest, createMetricsRouter(services.metrics, authRepository));
}

import type { RequestHandler } from "express";
import { sql } from "kysely";

import { db as defaultDb, type DbExecutor } from "@/db/index.js";
import { redis as defaultRedis, type RedisClient } from "@/redis/index.js";
import { AccountPgRepository } from "@/module/argus/account/account.pg-repository.js";
import { AccountService } from "@/module/argus/account/account.service.js";
import { ActorPgRepository } from "@/module/actor/actor.pg-repository.js";
import { ActorService } from "@/module/actor/actor.service.js";
import { ArgusAlertPgRepository } from "@/module/argus/alert/argus-alert.pg-repository.js";
import { ArgusAlertService } from "@/module/argus/alert/argus-alert.service.js";
import { ArgusDmPgRepository } from "@/module/argus/direct-messages/argus-dm.pg-repository.js";
import { ArgusDmService } from "@/module/argus/direct-messages/argus-dm.service.js";
import { ArgusUserPgRepository } from "@/module/argus/argus-user/argus-user.pg-repository.js";
import { ArgusUserService } from "@/module/argus/argus-user/argus-user.service.js";
import { authenticate } from "@/module/auth/auth.middleware.js";
import { createRateLimiter } from "@/middleware/rate-limiter.js";
import { AuthRepository } from "@/module/auth/auth.repository.js";
import { AuthService } from "@/module/auth/auth.service.js";
import { AuditLogPgRepository } from "@/module/audit-log/audit-log.pg-repository.js";
import { AuditLogService } from "@/module/audit-log/audit-log.service.js";
import { BadgePgRepository } from "@/module/badge/badge.pg-repository.js";
import { BadgeService } from "@/module/badge/badge.service.js";
import { CatalogPgRepository } from "@/module/catalog/catalog.pg-repository.js";
import { CatalogService } from "@/module/catalog/catalog.service.js";
import { ChatMessageFlushWorker } from "@/module/chat-message/chat-message.flush-worker.js";
import { ChatMessagePgRepository } from "@/module/chat-message/chat-message.pg-repository.js";
import { ChatMessageRedisBuffer } from "@/module/chat-message/chat-message.redis-buffer.js";
import { ChatMessageService } from "@/module/chat-message/chat-message.service.js";
import { MetricsPgRepository } from "@/module/metrics/metrics.pg-repository.js";
import { MetricsService } from "@/module/metrics/metrics.service.js";
import { ModCasePgRepository } from "@/module/mod-case/mod-case.pg-repository.js";
import { ModCasePublisher } from "@/module/mod-case/mod-case.publisher.js";
import { ModCaseService } from "@/module/mod-case/mod-case.service.js";
import { PermissionPgRepository } from "@/module/permission/permission.pg-repository.js";
import { PermissionService } from "@/module/permission/permission.service.js";
import { PlayerSessionPgRepository } from "@/module/player-session/player-session.pg-repository.js";
import { PlayerSessionService } from "@/module/player-session/player-session.service.js";
import { PlayerPgRepository } from "@/module/player/player.pg-repository.js";
import { PlayerService } from "@/module/player/player.service.js";
import { GroupPgRepository } from "@/module/group/group.pg-repository.js";
import { GroupService } from "@/module/group/group.service.js";
import { PunishmentPgRepository } from "@/module/punishment/punishment.pg-repository.js";
import { PunishmentPublisher } from "@/module/punishment/punishment.publisher.js";
import { PunishmentService } from "@/module/punishment/punishment.service.js";
import { RankPgRepository } from "@/module/rank/rank.pg-repository.js";
import { RankService } from "@/module/rank/rank.service.js";
import { ReportPgRepository } from "@/module/report/report.pg-repository.js";
import { ReportPublisher } from "@/module/report/report.publisher.js";
import { ReportService } from "@/module/report/report.service.js";
import { ServerInstancePgRepository } from "@/module/server-instance/server-instance.pg-repository.js";
import { ServerInstanceService } from "@/module/server-instance/server-instance.service.js";
import { ServerPgRepository } from "@/module/server/server.pg-repository.js";
import { ServerService } from "@/module/server/server.service.js";
import { StaffPrivilegePgRepository } from "@/module/staff-privilege/staff-privilege.pg-repository.js";
import { StaffPrivilegeService } from "@/module/staff-privilege/staff-privilege.service.js";
import { WatchlistPgRepository } from "@/module/watchlist/watchlist.pg-repository.js";
import { WatchlistService } from "@/module/watchlist/watchlist.service.js";
import { PasswordSecurityService } from "@/module/argus/password-security/password-security.service.js";

/*
This should work for now; might take another swing at it in the future
 */

export type AppDependencies = {
  authRepository: AuthRepository;
  authenticateRequest: RequestHandler;
  rateLimit: ReturnType<typeof createRateLimiter>;
  services: {
    actor: ActorService;
    auth: AuthService;
    account: AccountService;
    argusAlert: ArgusAlertService;
    argusDm: ArgusDmService;
    argusUser: ArgusUserService;
    auditLog: AuditLogService;
    badge: BadgeService;
    catalog: CatalogService;
    chatMessage: ChatMessageService;
    metrics: MetricsService;
    modCase: ModCaseService;
    group: GroupService;
    permission: PermissionService;
    player: PlayerService;
    playerSession: PlayerSessionService;
    punishment: PunishmentService;
    rank: RankService;
    report: ReportService;
    serverInstance: ServerInstanceService;
    server: ServerService;
    staffPrivilege: StaffPrivilegeService;
    watchlist: WatchlistService;
  };
  workers: {
    chatMessageFlush: ChatMessageFlushWorker;
  };
  health: {
    ready: () => Promise<void>;
  };
};

type CreateAppDependenciesOptions = {
  database?: DbExecutor;
  redisClient?: RedisClient;
  chatMessageWorkerRedisClient?: RedisClient;
};

export function createAppDependencies({
  database = defaultDb,
  redisClient = defaultRedis,
  chatMessageWorkerRedisClient = redisClient,
}: CreateAppDependenciesOptions = {}): AppDependencies {
  const actorRepository = new ActorPgRepository(database);
  const accountRepository = new AccountPgRepository(database);
  const argusAlertRepository = new ArgusAlertPgRepository(database);
  const argusDmRepository = new ArgusDmPgRepository(database);
  const argusUserRepository = new ArgusUserPgRepository(database);
  const authRepository = new AuthRepository(database);
  const auditLogRepository = new AuditLogPgRepository(database);
  const badgeRepository = new BadgePgRepository(database);
  const catalogRepository = new CatalogPgRepository(database);
  const chatMessageRepository = new ChatMessagePgRepository(database);
  const chatMessageBuffer = new ChatMessageRedisBuffer(redisClient);
  const metricsRepository = new MetricsPgRepository(database);
  const modCaseRepository = new ModCasePgRepository(database);
  const groupRepository = new GroupPgRepository(database);
  const permissionRepository = new PermissionPgRepository(database);
  const playerRepository = new PlayerPgRepository(database);
  const playerSessionRepository = new PlayerSessionPgRepository(database);
  const punishmentRepository = new PunishmentPgRepository(database);
  const rankRepository = new RankPgRepository(database);
  const reportRepository = new ReportPgRepository(database);
  const serverInstanceRepository = new ServerInstancePgRepository(database);
  const serverRepository = new ServerPgRepository(database);
  const staffPrivilegeRepository = new StaffPrivilegePgRepository(database);
  const watchlistRepository = new WatchlistPgRepository(database);

  // Explicit order
  const passwordSecurity = new PasswordSecurityService(redisClient);
  const authService = new AuthService(authRepository, redisClient, passwordSecurity);
  const playerService = new PlayerService(playerRepository);

  return {
    authRepository,
    authenticateRequest: authenticate(authService),
    rateLimit: createRateLimiter(redisClient),
    services: {
      actor: new ActorService(actorRepository),
      auth: authService,
      account: new AccountService(accountRepository, authService, passwordSecurity),
      argusAlert: new ArgusAlertService(argusAlertRepository),
      argusDm: new ArgusDmService(argusDmRepository),
      argusUser: new ArgusUserService(argusUserRepository),
      auditLog: new AuditLogService(auditLogRepository),
      badge: new BadgeService(badgeRepository),
      catalog: new CatalogService(catalogRepository),
      chatMessage: new ChatMessageService(chatMessageRepository, chatMessageBuffer),
      metrics: new MetricsService(metricsRepository),
      modCase: new ModCaseService(modCaseRepository, new ModCasePublisher(redisClient)),
      group: new GroupService(groupRepository),
      permission: new PermissionService(permissionRepository),
      player: playerService,
      playerSession: new PlayerSessionService(playerSessionRepository),
      punishment: new PunishmentService(punishmentRepository, new PunishmentPublisher(redisClient)),
      rank: new RankService(rankRepository),
      report: new ReportService(reportRepository, new ReportPublisher(redisClient)),
      serverInstance: new ServerInstanceService(
        serverInstanceRepository,
        playerService,
        redisClient,
      ),
      server: new ServerService(serverRepository, redisClient, playerService),
      staffPrivilege: new StaffPrivilegeService(staffPrivilegeRepository),
      watchlist: new WatchlistService(watchlistRepository),
    },
    workers: {
      chatMessageFlush: new ChatMessageFlushWorker(
        chatMessageWorkerRedisClient,
        chatMessageBuffer,
        chatMessageRepository,
      ),
    },
    health: {
      ready: async () => {
        await Promise.all([sql`SELECT 1`.execute(database), redisClient.ping()]);
      },
    },
  };
}

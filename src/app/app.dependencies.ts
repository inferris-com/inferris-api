import type { RequestHandler } from "express";

import { db as defaultDb, type DbExecutor } from "../db/index.js";
import { ActorPgRepository } from "../module/actor/actor.pg-repository.js";
import { ActorService } from "../module/actor/actor.service.js";
import { authenticate } from "../module/auth/auth.middleware.js";
import { AuthRepository } from "../module/auth/auth.repository.js";
import { AuthService } from "../module/auth/auth.service.js";
import { CatalogPgRepository } from "../module/catalog/catalog.pg-repository.js";
import { CatalogService } from "../module/catalog/catalog.service.js";
import { ChatMessageFlushWorker } from "../module/chat-message/chat-message.flush-worker.js";
import { ChatMessagePgRepository } from "../module/chat-message/chat-message.pg-repository.js";
import { ChatMessageRedisBuffer } from "../module/chat-message/chat-message.redis-buffer.js";
import { ChatMessageService } from "../module/chat-message/chat-message.service.js";
import { ModCasePgRepository } from "../module/mod-case/mod-case.pg-repository.js";
import { ModCasePublisher } from "../module/mod-case/mod-case.publisher.js";
import { ModCaseService } from "../module/mod-case/mod-case.service.js";
import { PermissionPgRepository } from "../module/permission/permission.pg-repository.js";
import { PermissionService } from "../module/permission/permission.service.js";
import { PlayerPgRepository } from "../module/player/player.pg-repository.js";
import { PlayerService } from "../module/player/player.service.js";
import { PunishmentPgRepository } from "../module/punishment/punishment.pg-repository.js";
import { PunishmentPublisher } from "../module/punishment/punishment.publisher.js";
import { PunishmentService } from "../module/punishment/punishment.service.js";
import { ReportPgRepository } from "../module/report/report.pg-repository.js";
import { ReportPublisher } from "../module/report/report.publisher.js";
import { ReportService } from "../module/report/report.service.js";
import { ServerPgRepository } from "../module/server/server.pg-repository.js";
import { ServerService } from "../module/server/server.service.js";
import { WatchlistPgRepository } from "../module/watchlist/watchlist.pg-repository.js";
import { WatchlistService } from "../module/watchlist/watchlist.service.js";
import { redis as defaultRedis, type RedisClient } from "../redis/index.js";

/*
This should work for now; might take another swing at it in the future
 */

export type AppDependencies = {
  authRepository: AuthRepository;
  authenticateRequest: RequestHandler;
  services: {
    actor: ActorService;
    auth: AuthService;
    catalog: CatalogService;
    chatMessage: ChatMessageService;
    modCase: ModCaseService;
    permission: PermissionService;
    player: PlayerService;
    punishment: PunishmentService;
    report: ReportService;
    server: ServerService;
    watchlist: WatchlistService;
  };
  workers: {
    chatMessageFlush: ChatMessageFlushWorker;
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
  const authRepository = new AuthRepository(database);
  const catalogRepository = new CatalogPgRepository(database);
  const chatMessageRepository = new ChatMessagePgRepository(database);
  const chatMessageBuffer = new ChatMessageRedisBuffer(redisClient);
  const modCaseRepository = new ModCasePgRepository(database);
  const permissionRepository = new PermissionPgRepository(database);
  const playerRepository = new PlayerPgRepository(database);
  const punishmentRepository = new PunishmentPgRepository(database);
  const reportRepository = new ReportPgRepository(database);
  const serverRepository = new ServerPgRepository(database);
  const watchlistRepository = new WatchlistPgRepository(database);

  const authService = new AuthService(authRepository, redisClient);
  const playerService = new PlayerService(playerRepository);

  return {
    authRepository,
    authenticateRequest: authenticate(authService),
    services: {
      actor: new ActorService(actorRepository),
      auth: authService,
      catalog: new CatalogService(catalogRepository),
      chatMessage: new ChatMessageService(chatMessageRepository, chatMessageBuffer),
      modCase: new ModCaseService(modCaseRepository, new ModCasePublisher(redisClient)),
      permission: new PermissionService(permissionRepository),
      player: playerService,
      punishment: new PunishmentService(punishmentRepository, new PunishmentPublisher(redisClient)),
      report: new ReportService(reportRepository, new ReportPublisher(redisClient)),
      server: new ServerService(serverRepository, redisClient, playerService),
      watchlist: new WatchlistService(watchlistRepository),
    },
    workers: {
      chatMessageFlush: new ChatMessageFlushWorker(
        chatMessageWorkerRedisClient,
        chatMessageBuffer,
        chatMessageRepository,
      ),
    },
  };
}

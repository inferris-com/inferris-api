import express from "express";
import type { Server as HttpServer } from "node:http";

import { createCronJobs } from "./cron/jobs.js";
import { CronScheduler } from "./cron/cron.scheduler.js";
import { db } from "./db/index.js";
import { errorHandler } from "./error/app-error.js";
import { logger } from "./logger.js";
import { PlayerPgRepository } from "./module/player/player.pg-repository.js";
import { createPlayerRouter } from "./module/player/player.route.js";
import { PlayerService } from "./module/player/player.service.js";
import { pinoHttp } from "pino-http";
import { createServerRouter } from "./module/server/server.route.js";
import { ServerPgRepository } from "./module/server/server.pg-repository.js";
import { ServerService } from "./module/server/server.service.js";
import { createActorRouter } from "./module/actor/actor.route.js";
import { ActorService } from "./module/actor/actor.service.js";
import { ActorPgRepository } from "./module/actor/actor.pg-repository.js";
import { connectRedis, disconnectRedis } from "./redis/index.js";
import { createPermissionRouter } from "./module/permission/permission.route.js";
import { PermissionService } from "./module/permission/permission.service.js";
import { PermissionPgRepository } from "./module/permission/permission.pg-repository.js";
import { AuthRepository } from "./module/auth/auth.repository.js";
import { AuthService } from "./module/auth/auth.service.js";
import { redis } from "./redis/index.js";
import { createAuthRouter } from "./module/auth/auth.route.js";
import { authenticate } from "./module/auth/auth.middleware.js";
import { createPunishmentRouter } from "./module/punishment/punishment.route.js";
import { PunishmentService } from "./module/punishment/punishment.service.js";
import { PunishmentPgRepository } from "./module/punishment/punishment.pg-repository.js";
import { PunishmentPublisher } from "./module/punishment/punishment.publisher.js";
import { createReportRouter } from "./module/report/report.route.js";
import { ReportService } from "./module/report/report.service.js";
import { ReportPgRepository } from "./module/report/report.pg-repository.js";
import { ReportPublisher } from "./module/report/report.publisher.js";
import { createModCaseRouter } from "./module/mod-case/mod-case.route.js";
import { ModCaseService } from "./module/mod-case/mod-case.service.js";
import { ModCasePgRepository } from "./module/mod-case/mod-case.pg-repository.js";
import { ModCasePublisher } from "./module/mod-case/mod-case.publisher.js";
import { ChatMessagePgRepository } from "./module/chat-message/chat-message.pg-repository.js";
import { ChatMessageRedisBuffer } from "./module/chat-message/chat-message.redis-buffer.js";
import { ChatMessageService } from "./module/chat-message/chat-message.service.js";
import { createChatMessageRouter } from "./module/chat-message/chat-message.route.js";
import { ChatMessageFlushWorker } from "./module/chat-message/chat-message.flush-worker.js";

type ServerProps = {
  host?: string;
  port?: number;
};

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", true);

  app.use(express.json());

  // Logger
  app.use(
    pinoHttp({
      logger,
    }),
  );

  // Root app routes
  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  const authRepository = new AuthRepository(db);
  const authService = new AuthService(authRepository, redis);
  const authenticateRequest = authenticate(authService);
  const punishmentService = new PunishmentService(
    new PunishmentPgRepository(db),
    new PunishmentPublisher(redis),
  );
  const chatMessageService = new ChatMessageService(
    new ChatMessagePgRepository(db),
    new ChatMessageRedisBuffer(redis),
  );

  app.use("/auth", createAuthRouter(authService));
  app.use(
    "/players",
    authenticateRequest,
    createPlayerRouter(new PlayerService(new PlayerPgRepository(db)), authRepository),
  );
  app.use(
    "/actors",
    authenticateRequest,
    createActorRouter(new ActorService(new ActorPgRepository(db)), authRepository),
  );
  app.use(
    "/servers",
    authenticateRequest,
    createServerRouter(new ServerService(new ServerPgRepository(db)), authRepository),
  );
  app.use(
    "/permissions",
    authenticateRequest,
    createPermissionRouter(new PermissionService(new PermissionPgRepository(db)), authRepository),
  );
  app.use(
    "/punishments",
    authenticateRequest,
    createPunishmentRouter(punishmentService, authRepository),
  );
  app.use(
    "/reports",
    authenticateRequest,
    createReportRouter(
      new ReportService(new ReportPgRepository(db), new ReportPublisher(redis)),
      authRepository,
    ),
  );
  app.use(
    "/mod-cases",
    authenticateRequest,
    createModCaseRouter(
      new ModCaseService(new ModCasePgRepository(db), new ModCasePublisher(redis)),
      authRepository,
    ),
  );
  app.use(
    "/chat-messages",
    authenticateRequest,
    createChatMessageRouter(chatMessageService, authRepository),
  );

  // Middlewares
  app.use(errorHandler);

  return app;
}

export async function startServer({ host = "0.0.0.0", port = 3000 }: ServerProps) {
  await connectRedis();

  const app = createApp();
  const cronScheduler = new CronScheduler();
  const punishmentService = new PunishmentService(
    new PunishmentPgRepository(db),
    new PunishmentPublisher(redis),
  );
  const chatMessageBuffer = new ChatMessageRedisBuffer(redis);
  const chatMessageFlushWorker = new ChatMessageFlushWorker(
    redis,
    chatMessageBuffer,
    new ChatMessagePgRepository(db),
  );

  cronScheduler.start(createCronJobs(punishmentService));
  chatMessageFlushWorker.start();

  const server = app.listen(port, host, () => {
    console.log(`Listening on ${host}:${port}`);
  });

  registerShutdown(server, cronScheduler, chatMessageFlushWorker);

  return server;
}

function registerShutdown(
  server: HttpServer,
  cronScheduler: CronScheduler,
  chatMessageFlushWorker: ChatMessageFlushWorker,
) {
  const shutdown = (signal: NodeJS.Signals) => {
    logger.info({ signal }, "Shutting down server");
    cronScheduler.stop();

    void chatMessageFlushWorker
      .stop()
      .then(() => closeServer(server))
      .then(() => Promise.all([disconnectRedis(), db.destroy()]))
      .then(() => {
        process.exit(0);
      })
      .catch((error: unknown) => {
        logger.error({ error }, "Shutdown failed");
        process.exit(1);
      });
  };

  process.once("SIGINT", (signal) => {
    shutdown(signal);
  });
  process.once("SIGTERM", (signal) => {
    shutdown(signal);
  });
}

function closeServer(server: HttpServer) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

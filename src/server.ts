import express from "express";
import type { Server as HttpServer } from "node:http";
import { pinoHttp } from "pino-http";
import * as swaggerUi from "swagger-ui-express";

import { createAppDependencies } from "./app/app.dependencies.js";
import type { BackgroundRuntime } from "./app/background.runtime.js";
import { createBackgroundRuntime } from "./app/background.runtime.js";
import { registerAppRoutes } from "./app/app.routes.js";
import { db } from "./db/index.js";
import { errorHandler } from "./error/app-error.js";
import { logger } from "./logger.js";
import {
  connectRedis,
  createRedisClient,
  disconnectRedis,
  type RedisClient,
} from "./redis/index.js";
import { openApiDocument } from "./openapi/openapi.js";

type ServerProps = {
  host?: string;
  port?: number;
};

export function createApp(dependencies = createAppDependencies()) {
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
  app.get("/livez", (_req, res) => {
    res.json({ ok: true });
  });
  app.get("/readyz", (_req, res) => {
    res.json({ ok: true });
  });
  app.get("/openapi.json", (_req, res) => {
    res.json(openApiDocument);
  });
  app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: "Inferris API Docs",
    }),
  );

  registerAppRoutes(app, dependencies);

  // Middlewares
  app.use(errorHandler);

  return app;
}

export async function startServer({ host = "0.0.0.0", port = 3000 }: ServerProps) {
  const chatMessageWorkerRedis = createRedisClient();

  await Promise.all([connectRedis(), connectRedis(chatMessageWorkerRedis)]);

  const dependencies = createAppDependencies({
    chatMessageWorkerRedisClient: chatMessageWorkerRedis,
  });
  const app = createApp(dependencies);
  const backgroundRuntime = createBackgroundRuntime(dependencies);
  backgroundRuntime.start();

  const server = app.listen(port, host, () => {
    console.log(`Listening on ${host}:${port}`);
  });

  registerShutdown(server, backgroundRuntime, chatMessageWorkerRedis);

  return server;
}

function registerShutdown(
  server: HttpServer,
  backgroundRuntime: BackgroundRuntime,
  chatMessageWorkerRedis: RedisClient,
) {
  const shutdown = (signal: NodeJS.Signals) => {
    logger.info({ signal }, "Shutting down server");

    void backgroundRuntime
      .stop()
      .then(() => closeServer(server))
      .then(() =>
        Promise.all([disconnectRedis(chatMessageWorkerRedis), disconnectRedis(), db.destroy()]),
      )
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

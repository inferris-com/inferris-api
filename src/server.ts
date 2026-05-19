import express from "express";

import { db } from "./db/index.js";
import { errorHandler } from "./error/app-error.js";
import { logger } from "./logger.js";
import { PgPlayerRepository } from "./module/player/player.pg-repository.js";
import { createPlayerRouter } from "./module/player/player.route.js";
import { PlayerService } from "./module/player/player.service.js";
import { pinoHttp } from "pino-http";

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
  app.use("/players", createPlayerRouter(new PlayerService(new PgPlayerRepository(db))));

  // Middlewares
  app.use(errorHandler);

  return app;
}

export function startServer({ host = "0.0.0.0", port = 3000 }: ServerProps) {
  const app = createApp();

  app.listen(port, host, () => {
    console.log(`Listening on ${host}:${port}`);
  });
}

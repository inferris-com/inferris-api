import express from "express";

type ServerProps = {
  host?: string;
  port?: number;
};

export function createApp() {
  const app = express();

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}

export function startServer({ host = "0.0.0.0", port = 3000 }: ServerProps) {
  const app = createApp();

  app.listen(port, host, () => {
    console.log(`Listening on ${host}:${port}`);
  });
}

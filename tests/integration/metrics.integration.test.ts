import { describe, expect, test } from "@jest/globals";

import { createTestApp, ids } from "@tests/integration/app-test-utils.js";

describe("metrics routes", () => {
  test("GET /metrics/overview returns metrics overview envelope", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.metrics.getOverview.mockResolvedValue({
      generatedAtMs: "1000",
      window: "1h",
      current: {
        onlinePlayerCount: 12,
        serverCount: 2,
        onlineServerCount: 1,
        staleServerCount: 1,
        averageCompletedSessionSeconds: 300,
      },
      servers: [],
      series: [],
    });

    const response = await request
      .get("/metrics/overview")
      .set("Authorization", "Bearer moderator-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        generatedAtMs: "1000",
        window: "1h",
        current: {
          onlinePlayerCount: 12,
          serverCount: 2,
          onlineServerCount: 1,
          staleServerCount: 1,
          averageCompletedSessionSeconds: 300,
        },
        servers: [],
        series: [],
      },
    });
    expect(dependencies.services.metrics.getOverview).toHaveBeenCalledWith("1h");
  });

  test("GET /metrics/servers/:serverId returns server metrics envelope", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.metrics.getServerMetrics.mockResolvedValue({
      generatedAtMs: "1000",
      window: "15m",
      server: {
        serverId: ids.server,
        name: "lobby",
        type: "paper",
        environment: "development",
        status: "online",
        lastHeartbeatAtMs: "900",
        heartbeatAgeMs: 100,
        isStale: false,
        onlinePlayerCount: 12,
        reportedOnlinePlayerCount: 12,
        maxPlayers: 100,
        tps1m: 19.98,
        tps5m: null,
        tps15m: null,
        msptAvg: 22.4,
        msptP95: null,
        heapUsedBytes: "268435456",
        heapMaxBytes: "1073741824",
        loadedChunks: 1200,
        loadedWorlds: 3,
        backendServerCount: null,
      },
      series: [],
    });

    const response = await request
      .get(`/metrics/servers/${ids.server}?window=15m`)
      .set("Authorization", "Bearer moderator-token");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      data: {
        generatedAtMs: "1000",
        window: "15m",
        server: {
          serverId: ids.server,
          name: "lobby",
          onlinePlayerCount: 12,
        },
        series: [],
      },
    });
    expect(dependencies.services.metrics.getServerMetrics).toHaveBeenCalledWith(ids.server, "15m");
  });

  test("GET /metrics/overview requires server read authority", async () => {
    const { dependencies, request } = createTestApp();

    const response = await request
      .get("/metrics/overview")
      .set("Authorization", "ApiKey read-only-token");

    expect(response.status).toBe(403);
    expect(dependencies.services.metrics.getOverview).not.toHaveBeenCalled();
  });
});

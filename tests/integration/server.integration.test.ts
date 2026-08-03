import { describe, expect, test } from "@jest/globals";

import { ServerNotFoundError } from "@/module/server/server.errors.js";
import { createTestApp, ids } from "@tests/integration/app-test-utils.js";

describe("server and lockdown routes", () => {
  test("GET /servers returns list envelope for plugin cache warmup", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.server.listServers.mockResolvedValue([
      {
        id: ids.server,
        name: "lobby",
        type: "paper",
        environment: "development",
        port: 25565,
      },
    ]);

    const response = await request.get("/servers").set("Authorization", "ApiKey server-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [
        {
          id: ids.server,
          name: "lobby",
          type: "paper",
          environment: "development",
          port: 25565,
        },
      ],
      meta: { count: 1 },
    });
    expect(dependencies.services.server.listServers).toHaveBeenCalledWith();
  });

  test("POST /servers/register registers by stable server name", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.server.registerServer.mockResolvedValue({
      id: ids.server,
      name: "lobby",
      type: "paper",
      environment: "development",
      port: 25565,
    });

    const response = await request
      .post("/servers/register")
      .set("Authorization", "ApiKey server-token")
      .send({
        name: "lobby",
        type: "paper",
        environment: "development",
        port: 25565,
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      data: {
        id: ids.server,
        name: "lobby",
      },
    });
    expect(dependencies.services.server.registerServer).toHaveBeenCalledWith({
      name: "lobby",
      type: "paper",
      environment: "development",
      port: 25565,
    });
  });

  test("POST /servers/:serverId/network-sessions is removed", async () => {
    const { dependencies, request } = createTestApp();

    const response = await request
      .post(`/servers/${ids.server}/network-sessions`)
      .set("Authorization", "ApiKey server-token")
      .send({
        mojangId: ids.player,
        username: "Developer",
      });

    expect(response.status).toBe(404);
    expect(dependencies.services.server.startNetworkSession).not.toHaveBeenCalled();
  });

  test("POST /servers/:serverId/server-visits is removed", async () => {
    const { dependencies, request } = createTestApp();

    const response = await request
      .post(`/servers/${ids.server}/server-visits`)
      .set("Authorization", "MinecraftSession player-token")
      .set("X-Api-Key", "server-token")
      .send({
        mojangId: ids.player,
        username: "Developer",
      });

    expect(response.status).toBe(404);
    expect(dependencies.services.server.startBackendSession).not.toHaveBeenCalled();
  });

  test("DELETE /servers/:serverId/network-sessions/:mojangId ends network session", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.server.endNetworkSession.mockResolvedValue(undefined);

    const response = await request
      .delete(`/servers/${ids.server}/network-sessions/${ids.player}`)
      .set("Authorization", "ApiKey server-token");

    expect(response.status).toBe(404);
    expect(dependencies.services.server.endNetworkSession).not.toHaveBeenCalled();
  });

  test("DELETE /servers/:serverId/server-visits/:mojangId ends backend visit", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.server.endBackendSession.mockResolvedValue(undefined);

    const response = await request
      .delete(`/servers/${ids.server}/server-visits/${ids.player}`)
      .set("Authorization", "MinecraftSession player-token")
      .set("X-Api-Key", "server-token");

    expect(response.status).toBe(404);
    expect(dependencies.services.server.endBackendSession).not.toHaveBeenCalled();
  });

  test("POST /servers/:serverId/server-visits requires Minecraft session context", async () => {
    const { dependencies, request } = createTestApp();

    const response = await request
      .post(`/servers/${ids.server}/server-visits`)
      .set("Authorization", "ApiKey server-token")
      .send({
        mojangId: ids.player,
        username: "Developer",
      });

    expect(response.status).toBe(404);
    expect(dependencies.services.server.startBackendSession).not.toHaveBeenCalled();
  });

  test("POST /servers requires admin staff authority", async () => {
    const { dependencies, request } = createTestApp();

    const response = await request
      .post("/servers")
      .set("Authorization", "Bearer unprivileged-token")
      .send({
        name: "Lobby",
        type: "paper",
        environment: "development",
        port: 25565,
      });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      error: {
        code: "FORBIDDEN",
      },
    });
    expect(dependencies.services.server.createServer).not.toHaveBeenCalled();
    expect(dependencies.authRepository.insertAuditLog).toHaveBeenCalled();
  });

  test("POST /servers/:serverId/lockdown injects issuing actor", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.server.createLockdown.mockResolvedValue({
      id: "lockdown-1",
      serverId: ids.server,
      issuedByActorId: ids.actor,
    });

    const response = await request
      .post(`/servers/${ids.server}/lockdown`)
      .set("Authorization", "Bearer moderator-token")
      .send({
        scope: "local",
        requiredRankKey: "moderator",
        reason: "Maintenance",
        startsAtMs: "1000",
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      data: {
        issuedByActorId: ids.actor,
      },
    });
    expect(dependencies.services.server.createLockdown).toHaveBeenCalledWith(ids.server, {
      scope: "local",
      requiredRankKey: "moderator",
      reason: "Maintenance",
      startsAtMs: "1000",
      isActive: true,
      issuedByActorId: ids.actor,
    });
  });

  test("POST /servers/:serverId/lockdown uses service actor API-key owner", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.server.createLockdown.mockResolvedValue({
      id: "lockdown-1",
      serverId: ids.server,
      issuedByActorId: ids.apiKeyOwnerActor,
    });

    const response = await request
      .post(`/servers/${ids.server}/lockdown`)
      .set("Authorization", "ApiKey service-actor-token")
      .send({
        scope: "local",
        requiredRankKey: "moderator",
        reason: "Maintenance",
        startsAtMs: "1000",
      });

    expect(response.status).toBe(200);
    expect(dependencies.services.server.createLockdown).toHaveBeenCalledWith(ids.server, {
      scope: "local",
      requiredRankKey: "moderator",
      reason: "Maintenance",
      startsAtMs: "1000",
      isActive: true,
      issuedByActorId: ids.apiKeyOwnerActor,
    });
  });

  test("POST /servers/:serverId/heartbeat is removed", async () => {
    const { dependencies, request } = createTestApp();

    const response = await request
      .post(`/servers/${ids.server}/heartbeat`)
      .set("Authorization", "ApiKey server-token")
      .send({
        status: "online",
        port: 25565,
        version: "1.21.8",
        onlineMojangIds: [],
        metrics: {
          onlinePlayerCount: 12,
          maxPlayers: 100,
          tps1m: 19.98,
          msptAvg: 22.4,
          heapUsedBytes: 268435456,
          heapMaxBytes: 1073741824,
          loadedChunks: 1200,
          loadedWorlds: 3,
        },
      });

    expect(response.status).toBe(404);
    expect(dependencies.services.server.heartbeat).not.toHaveBeenCalled();
  });

  test("POST /servers/:serverId/heartbeat invalid payload still uses removed route", async () => {
    const { dependencies, request } = createTestApp();

    const response = await request
      .post(`/servers/${ids.server}/heartbeat`)
      .set("Authorization", "ApiKey server-token")
      .send({
        onlineMojangIds: [],
        metrics: {
          tps1m: -1,
        },
      });

    expect(response.status).toBe(404);
    expect(dependencies.services.server.heartbeat).not.toHaveBeenCalled();
  });

  test("POST /servers/:serverId/lockdown rejects body-supplied issuing actor", async () => {
    const { dependencies, request } = createTestApp();

    const response = await request
      .post(`/servers/${ids.server}/lockdown`)
      .set("Authorization", "Bearer moderator-token")
      .send({
        scope: "local",
        requiredRankKey: "moderator",
        reason: "Maintenance",
        startsAtMs: "1000",
        issuedByActorId: ids.actingActor,
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
      },
    });
    expect(dependencies.services.server.createLockdown).not.toHaveBeenCalled();
  });

  test("GET /servers/:serverId/lockdown returns lockdown envelope", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.server.getLockdownByServer.mockResolvedValue({
      id: "lockdown-1",
      serverId: ids.server,
      scope: "local",
      isActive: true,
    });

    const response = await request
      .get(`/servers/${ids.server}/lockdown`)
      .set("Authorization", "Bearer moderator-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        id: "lockdown-1",
        serverId: ids.server,
        scope: "local",
        isActive: true,
      },
    });
  });

  test("GET /servers/lockdowns/global/active returns active global lockdown envelope", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.server.getActiveGlobalLockdown.mockResolvedValue({
      id: "lockdown-1",
      serverId: null,
      scope: "global",
      isActive: true,
    });

    const response = await request
      .get("/servers/lockdowns/global/active")
      .set("Authorization", "Bearer moderator-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        id: "lockdown-1",
        serverId: null,
        scope: "global",
        isActive: true,
      },
    });
  });

  test("GET /servers/lockdowns/global/active returns 404 when no global lockdown is active", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.server.getActiveGlobalLockdown.mockRejectedValue(
      new ServerNotFoundError("global"),
    );

    const response = await request
      .get("/servers/lockdowns/global/active")
      .set("Authorization", "Bearer moderator-token");

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        code: "SERVER_NOT_FOUND",
      },
    });
  });
});

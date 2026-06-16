import { describe, expect, test } from "@jest/globals";

import { ServerNotFoundError } from "../../src/module/server/server.errors.js";
import { createTestApp, ids } from "./app-test-utils.js";

describe("server and lockdown routes", () => {
  test("POST /servers/register registers by stable server name", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.server.registerServer.mockResolvedValue({
      id: ids.server,
      name: "lobby",
      type: "paper",
      environment: "development",
      status: "online",
      port: 25565,
      version: "1.21.8",
    });

    const response = await request
      .post("/servers/register")
      .set("Authorization", "ApiKey server-token")
      .send({
        name: "lobby",
        type: "paper",
        environment: "development",
        status: "online",
        port: 25565,
        version: "1.21.8",
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
      status: "online",
      port: 25565,
      version: "1.21.8",
    });
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
        version: "1.21.8",
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

  test("POST /servers/:serverId/lockdown uses API-key acting actor", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.server.createLockdown.mockResolvedValue({
      id: "lockdown-1",
      serverId: ids.server,
      issuedByActorId: ids.actingActor,
    });

    const response = await request
      .post(`/servers/${ids.server}/lockdown`)
      .set("Authorization", "ApiKey server-token")
      .set("X-Inferris-Actor-Id", ids.actingActor)
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
      issuedByActorId: ids.actingActor,
    });
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

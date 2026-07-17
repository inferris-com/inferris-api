import { describe, expect, test } from "@jest/globals";

import { createTestApp, ids } from "./app-test-utils.js";

describe("server instance routes", () => {
  test("POST /server-instances/register registers a process boot", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.serverInstance.registerInstance.mockResolvedValue({
      id: ids.chatMessage,
      serverId: ids.server,
      state: "active",
      runtimePort: 25565,
      version: "1.21.8",
      startedAtMs: "1000",
      drainingAtMs: null,
      stoppedAtMs: null,
      lostAtMs: null,
      supersededAtMs: null,
      lastHeartbeatAtMs: "1000",
      heartbeatIntervalMs: "30000",
      lastEventSequence: "0",
      isSyntheticBackfill: false,
      createdAtMs: "1000",
      updatedAtMs: null,
      token: "instance-token",
    });

    const response = await request
      .post("/server-instances/register")
      .set("Authorization", "ApiKey server-token")
      .send({
        serverId: ids.server,
        runtimePort: 25565,
        version: "1.21.8",
        heartbeatIntervalMs: 30000,
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      data: {
        id: ids.chatMessage,
        serverId: ids.server,
        token: "instance-token",
      },
    });
    expect(dependencies.services.serverInstance.registerInstance).toHaveBeenCalledWith({
      serverId: ids.server,
      runtimePort: 25565,
      version: "1.21.8",
      heartbeatIntervalMs: 30000,
    });
  });

  test("PUT /server-instances/:serverInstanceId/heartbeat uses matching instance token", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.serverInstance.heartbeat.mockResolvedValue({
      serverInstanceId: ids.chatMessage,
      state: "active",
      lastHeartbeatAtMs: "2000",
    });

    const response = await request
      .put(`/server-instances/${ids.chatMessage}/heartbeat`)
      .set("Authorization", "Bearer instance-token")
      .send({ observedAtMs: "2000" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        serverInstanceId: ids.chatMessage,
        state: "active",
        lastHeartbeatAtMs: "2000",
      },
    });
    expect(dependencies.services.serverInstance.heartbeat).toHaveBeenCalledWith(
      expect.objectContaining({ id: ids.chatMessage, serverId: ids.server }),
      { observedAtMs: "2000" },
    );
  });

  test("POST /server-instances/:serverInstanceId/events accepts ordered event payloads", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.serverInstance.processEvent.mockResolvedValue({
      serverInstanceId: ids.chatMessage,
      eventId: "evt-1",
      sequence: "1",
      type: "BACKEND_CONNECTED",
      idempotent: false,
    });

    const response = await request
      .post(`/server-instances/${ids.chatMessage}/events`)
      .set("Authorization", "Bearer instance-token")
      .send({
        eventId: "evt-1",
        sequence: 1,
        type: "BACKEND_CONNECTED",
        payload: {
          mojangId: ids.player,
          backendServerId: ids.argusDmConversation,
        },
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      data: {
        eventId: "evt-1",
        sequence: "1",
        type: "BACKEND_CONNECTED",
        idempotent: false,
      },
    });
  });

  test("server instance token cannot report for a different path id", async () => {
    const { dependencies, request } = createTestApp();

    const response = await request
      .put(`/server-instances/${ids.argusDmConversation}/heartbeat`)
      .set("Authorization", "Bearer instance-token")
      .send({ observedAtMs: "2000" });

    expect(response.status).toBe(403);
    expect(dependencies.services.serverInstance.heartbeat).not.toHaveBeenCalled();
  });
});

import { describe, expect, test } from "@jest/globals";

import { createTestApp, ids } from "./app-test-utils.js";

describe("network session routes", () => {
  const networkSessionId = "11111111-1111-4111-8111-111111111111";

  test("GET /network-sessions lists network sessions", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.playerSession.listSessions.mockResolvedValue({
      rows: [
        {
          id: ids.chatMessage,
          playerId: ids.player,
          playerUsername: "Developer",
          playerMojangId: ids.player,
          actorId: ids.actor,
          proxyServerId: ids.server,
          proxyServerName: "velocity",
          currentBackendServerId: ids.argusDmConversation,
          currentBackendServerName: "lobby",
          currentBackendSessionId: ids.argusDmMessage,
          isLive: true,
          connectedAtMs: "1000",
          disconnectedAtMs: null,
          disconnectReason: null,
          meta: {},
          updatedAtMs: "1001",
          backendSessions: [],
        },
      ],
      total: 1,
      limit: 25,
      offset: 0,
    });

    const response = await request
      .get("/network-sessions?state=active&include=backendSessions")
      .set("Authorization", "ApiKey server-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [
        {
          id: ids.chatMessage,
          playerId: ids.player,
          playerUsername: "Developer",
          playerMojangId: ids.player,
          actorId: ids.actor,
          proxyServerId: ids.server,
          proxyServerName: "velocity",
          currentBackendServerId: ids.argusDmConversation,
          currentBackendServerName: "lobby",
          currentBackendSessionId: ids.argusDmMessage,
          isLive: true,
          connectedAtMs: "1000",
          disconnectedAtMs: null,
          disconnectReason: null,
          meta: {},
          updatedAtMs: "1001",
          backendSessions: [],
        },
      ],
      meta: {
        count: 1,
        total: 1,
        limit: 25,
        offset: 0,
      },
    });
    expect(dependencies.services.playerSession.listSessions).toHaveBeenCalledWith({
      state: "active",
      include: "backendSessions",
      limit: 25,
      offset: 0,
    });
  });

  test("GET /network-sessions/live is removed", async () => {
    const { dependencies, request } = createTestApp();

    const response = await request
      .get("/network-sessions/live")
      .set("Authorization", "ApiKey server-token");

    expect(response.status).toBe(404);
    expect(dependencies.services.playerSession.listSessions).not.toHaveBeenCalled();
  });

  test("GET /network-sessions/:networkSessionId returns one network session", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.playerSession.getSession.mockResolvedValue({
      id: networkSessionId,
      playerId: ids.player,
      playerUsername: "Developer",
      playerMojangId: ids.player,
      actorId: ids.actor,
      proxyServerId: ids.server,
      proxyServerName: "velocity",
      currentBackendServerId: null,
      currentBackendServerName: null,
      currentBackendSessionId: null,
      isLive: false,
      connectedAtMs: "1000",
      disconnectedAtMs: "2000",
      disconnectReason: "disconnect",
      meta: {},
      updatedAtMs: "2000",
    });

    const response = await request
      .get(`/network-sessions/${networkSessionId}?include=backendSessions`)
      .set("Authorization", "ApiKey server-token");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      data: {
        id: networkSessionId,
        proxyServerId: ids.server,
        isLive: false,
      },
    });
    expect(dependencies.services.playerSession.getSession).toHaveBeenCalledWith(
      networkSessionId,
      true,
    );
  });

  test("GET /player-sessions is removed", async () => {
    const { dependencies, request } = createTestApp();

    const response = await request
      .get("/player-sessions")
      .set("Authorization", "ApiKey server-token");

    expect(response.status).toBe(404);
    expect(dependencies.services.playerSession.listSessions).not.toHaveBeenCalled();
  });
});

import { describe, expect, test } from "@jest/globals";

import { createTestApp, ids } from "@tests/integration/app-test-utils.js";

describe("player routes", () => {
  test("GET /players returns list envelopes and parsed query defaults", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.player.listPlayers.mockResolvedValue([
      {
        id: ids.player,
        username: "Refrizor",
      },
    ]);

    const response = await request.get("/players").set("Authorization", "Bearer moderator-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [{ id: ids.player, username: "Refrizor" }],
      meta: { count: 1 },
    });
    expect(dependencies.services.player.listPlayers).toHaveBeenCalledWith({
      limit: 25,
      offset: 0,
    });
  });

  test("GET /players/search returns search envelopes and parsed query defaults", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.player.searchPlayers.mockResolvedValue([
      {
        id: ids.player,
        mojangId: "30000000-0000-0000-0000-000000000007",
        actorId: ids.actor,
        username: "Developer",
        activeNickname: null,
        deletedAtMs: null,
      },
    ]);

    const response = await request
      .get("/players/search?q=dev")
      .set("Authorization", "Bearer moderator-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [
        {
          id: ids.player,
          mojangId: "30000000-0000-0000-0000-000000000007",
          actorId: ids.actor,
          username: "Developer",
          activeNickname: null,
          deletedAtMs: null,
        },
      ],
      meta: { count: 1 },
    });
    expect(dependencies.services.player.searchPlayers).toHaveBeenCalledWith({
      q: "dev",
      limit: 10,
      sensitive: false,
    });
    expect(dependencies.services.player.getPlayer).not.toHaveBeenCalled();
  });

  test("GET /players/search rejects sensitive search without elevated read access", async () => {
    const { dependencies, request } = createTestApp();

    const response = await request
      .get("/players/search?q=dev&sensitive=true")
      .set("Authorization", "Bearer moderator-token");

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      error: {
        code: "FORBIDDEN",
      },
    });
    expect(dependencies.services.player.searchPlayers).not.toHaveBeenCalled();
  });

  test("GET /players/search allows sensitive search for admins", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.player.searchPlayers.mockResolvedValue([]);

    const response = await request
      .get("/players/search?q=dev&sensitive=true")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [],
      meta: { count: 0 },
    });
    expect(dependencies.services.player.searchPlayers).toHaveBeenCalledWith({
      q: "dev",
      limit: 10,
      sensitive: true,
    });
  });

  test("POST /players validates body before calling the service", async () => {
    const { dependencies, request } = createTestApp();

    const response = await request
      .post("/players")
      .set("Authorization", "Bearer admin-token")
      .send({ username: "MissingUuid" });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
      },
    });
    expect(dependencies.services.player.createPlayer).not.toHaveBeenCalled();
  });

  test("GET /players/by-mojang/:mojangId resolves by Mojang UUID", async () => {
    const { dependencies, request } = createTestApp();
    const mojangId = "30000000-0000-0000-0000-000000000007";
    dependencies.services.player.getPlayerByMojangId.mockResolvedValue({
      id: ids.player,
      mojangId,
      username: "Refrizor",
    });

    const response = await request
      .get(`/players/by-mojang/${mojangId}`)
      .set("Authorization", "Bearer moderator-token");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      data: {
        id: ids.player,
        mojangId,
      },
    });
    expect(dependencies.services.player.getPlayerByMojangId).toHaveBeenCalledWith(mojangId);
  });

  test("GET /players/:playerId allows read-only API keys", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.player.getPlayer.mockResolvedValue({
      id: ids.player,
      username: "Refrizor",
      orbs: 100,
    });

    const response = await request
      .get(`/players/${ids.player}`)
      .set("Authorization", "ApiKey read-only-token");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      data: {
        id: ids.player,
        username: "Refrizor",
        orbs: 100,
      },
    });
    expect(dependencies.services.player.getPlayer).toHaveBeenCalledWith(ids.player);
  });

  test("PUT /players/:playerId/ranks/:groupKey/:rankKey injects assigning actor", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.player.updateRankAssignment.mockResolvedValue({
      playerId: ids.player,
      groupKey: "staff",
      rankKey: "moderator",
      assignedByActorId: ids.actor,
    });

    const response = await request
      .put(`/players/${ids.player}/ranks/staff/moderator`)
      .set("Authorization", "Bearer admin-token")
      .send({ source: "argus" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      data: {
        assignedByActorId: ids.actor,
      },
    });
    expect(dependencies.services.player.updateRankAssignment).toHaveBeenCalledWith(
      ids.player,
      "staff",
      "moderator",
      {
        source: "argus",
        assignedByActorId: ids.actor,
      },
    );
  });

  test("PUT /players/:playerId/ranks/:groupKey/:rankKey uses service actor API-key owner", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.player.updateRankAssignment.mockResolvedValue({
      playerId: ids.player,
      groupKey: "staff",
      rankKey: "moderator",
      assignedByActorId: ids.apiKeyOwnerActor,
    });

    const response = await request
      .put(`/players/${ids.player}/ranks/staff/moderator`)
      .set("Authorization", "ApiKey service-actor-token")
      .send({ source: "minecraft" });

    expect(response.status).toBe(200);
    expect(dependencies.services.player.updateRankAssignment).toHaveBeenCalledWith(
      ids.player,
      "staff",
      "moderator",
      {
        source: "minecraft",
        assignedByActorId: ids.apiKeyOwnerActor,
      },
    );
  });

  test("PUT /players/:playerId/ranks/:groupKey/:rankKey rejects body-supplied assigning actor", async () => {
    const { dependencies, request } = createTestApp();

    const response = await request
      .put(`/players/${ids.player}/ranks/staff/moderator`)
      .set("Authorization", "Bearer admin-token")
      .send({ source: "argus", assignedByActorId: ids.actingActor });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
      },
    });
    expect(dependencies.services.player.updateRankAssignment).not.toHaveBeenCalled();
  });

  test("DELETE /players/:playerId rejects hard deletion", async () => {
    const { dependencies, request } = createTestApp();
    const response = await request
      .delete(`/players/${ids.player}?hard=true`)
      .set("Authorization", "Bearer admin-token");
    expect(response.status).toBe(400);
    expect(dependencies.services.player.deletePlayer).not.toHaveBeenCalled();
  });

  test.each(["", "?hard=false"])(
    "DELETE /players/:playerId%s archives the player",
    async (query) => {
      const { dependencies, request } = createTestApp();
      const response = await request
        .delete(`/players/${ids.player}${query}`)
        .set("Authorization", "Bearer admin-token");
      expect(response.status).toBe(204);
      expect(dependencies.services.player.deletePlayer).toHaveBeenCalledWith(ids.player);
    },
  );
});

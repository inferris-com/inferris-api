import { describe, expect, test } from "@jest/globals";

import { createTestApp, ids } from "./app-test-utils.js";

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

  test("POST /players validates body before calling the service", async () => {
    const { dependencies, request } = createTestApp();

    const response = await request
      .post("/players")
      .set("Authorization", "Bearer moderator-token")
      .send({ username: "MissingUuid" });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
      },
    });
    expect(dependencies.services.player.createPlayer).not.toHaveBeenCalled();
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
      .set("Authorization", "Bearer moderator-token")
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

  test("PUT /players/:playerId/ranks/:groupKey/:rankKey uses API-key acting actor", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.player.updateRankAssignment.mockResolvedValue({
      playerId: ids.player,
      groupKey: "staff",
      rankKey: "moderator",
      assignedByActorId: ids.actingActor,
    });

    const response = await request
      .put(`/players/${ids.player}/ranks/staff/moderator`)
      .set("Authorization", "ApiKey server-token")
      .set("X-Inferris-Actor-Id", ids.actingActor)
      .send({ source: "minecraft" });

    expect(response.status).toBe(200);
    expect(dependencies.services.player.updateRankAssignment).toHaveBeenCalledWith(
      ids.player,
      "staff",
      "moderator",
      {
        source: "minecraft",
        assignedByActorId: ids.actingActor,
      },
    );
  });

  test("PUT /players/:playerId/ranks/:groupKey/:rankKey rejects body-supplied assigning actor", async () => {
    const { dependencies, request } = createTestApp();

    const response = await request
      .put(`/players/${ids.player}/ranks/staff/moderator`)
      .set("Authorization", "Bearer moderator-token")
      .send({ source: "argus", assignedByActorId: ids.actingActor });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
      },
    });
    expect(dependencies.services.player.updateRankAssignment).not.toHaveBeenCalled();
  });
});

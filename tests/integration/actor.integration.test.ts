import { describe, expect, test } from "@jest/globals";

import { createTestApp, ids } from "@tests/integration/app-test-utils.js";

describe("actor routes", () => {
  test("GET /actors/search returns search envelopes and parsed query defaults", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.actor.searchActors.mockResolvedValue([
      {
        id: ids.actor,
        name: "Developer",
        type: "user",
        playerId: ids.player,
        createdAtMs: "1",
        lastUpdatedAtMs: null,
      },
    ]);

    const response = await request
      .get("/actors/search?q=dev")
      .set("Authorization", "Bearer moderator-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [
        {
          id: ids.actor,
          name: "Developer",
          type: "user",
          playerId: ids.player,
          createdAtMs: "1",
          lastUpdatedAtMs: null,
        },
      ],
      meta: { count: 1 },
    });
    expect(dependencies.services.actor.searchActors).toHaveBeenCalledWith({
      q: "dev",
      limit: 10,
    });
    expect(dependencies.services.actor.findActorById).not.toHaveBeenCalled();
  });

  test.each([
    { type: "system" },
    { playerId: ids.player },
    { createdAtMs: "1" },
    { lastUpdatedAtMs: "1" },
    { name: "Label", playerId: ids.player },
    {},
    { name: "   " },
  ])("PATCH /actors/:actorId rejects identity mutation: %j", async (body) => {
    const { dependencies, request } = createTestApp();
    const response = await request
      .patch(`/actors/${ids.actor}`)
      .set("Authorization", "Bearer admin-token")
      .send(body);
    expect(response.status).toBe(400);
    expect(dependencies.services.actor.updateActorById).not.toHaveBeenCalled();
  });
});

import { describe, expect, test } from "@jest/globals";

import { createTestApp, ids } from "./app-test-utils.js";

describe("punishment routes", () => {
  test("GET /punishments returns service pagination payload", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.punishment.listPunishments.mockResolvedValue({
      data: [
        {
          id: ids.punishment,
          type: "warn",
          subjectActorId: ids.actor,
        },
      ],
      meta: {
        count: 1,
        total: 1,
        limit: 25,
        offset: 0,
      },
    });

    const response = await request
      .get("/punishments?active=true")
      .set("Authorization", "Bearer moderator-token");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      meta: {
        count: 1,
        total: 1,
        limit: 25,
        offset: 0,
      },
    });
    expect(dependencies.services.punishment.listPunishments).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 25,
        offset: 0,
        active: true,
      }),
    );
  });

  test("POST /punishments validates exactly one subject identity", async () => {
    const { dependencies, request } = createTestApp();

    const response = await request
      .post("/punishments")
      .set("Authorization", "Bearer moderator-token")
      .send({ type: "warn", subjectActorId: ids.actor, subjectPlayerId: ids.player });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
      },
    });
    expect(dependencies.services.punishment.createPunishment).not.toHaveBeenCalled();
  });

  test("POST /punishments passes issuer actor from auth context", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.punishment.createPunishment.mockResolvedValue({
      id: ids.punishment,
      type: "warn",
      subjectActorId: ids.actor,
    });

    const response = await request
      .post("/punishments")
      .set("Authorization", "Bearer moderator-token")
      .send({ type: "warn", subjectActorId: ids.actor, reason: "Testing" });

    expect(response.status).toBe(201);
    expect(dependencies.services.punishment.createPunishment).toHaveBeenCalledWith(
      {
        type: "warn",
        subjectActorId: ids.actor,
        reason: "Testing",
        isSilent: false,
      },
      ids.actor,
    );
  });
});

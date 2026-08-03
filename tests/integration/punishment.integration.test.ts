import { describe, expect, test } from "@jest/globals";

import { createTestApp, ids } from "@tests/integration/app-test-utils.js";

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

  test("GET /punishments/code/:code resolves punishment by portable code", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.punishment.getPunishmentByCode.mockResolvedValue({
      id: ids.punishment,
      code: "AB12CD34EF",
      type: "warn",
      subjectActorId: ids.actor,
    });

    const response = await request
      .get("/punishments/code/AB12CD34EF")
      .set("Authorization", "Bearer moderator-token");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      data: {
        id: ids.punishment,
        code: "AB12CD34EF",
      },
    });
    expect(dependencies.services.punishment.getPunishmentByCode).toHaveBeenCalledWith("AB12CD34EF");
    expect(dependencies.services.punishment.getPunishment).not.toHaveBeenCalled();
  });

  test("GET /punishments/code/:code validates portable code format", async () => {
    const { dependencies, request } = createTestApp();

    const response = await request
      .get("/punishments/code/abc-123")
      .set("Authorization", "Bearer moderator-token");

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
      },
    });
    expect(dependencies.services.punishment.getPunishmentByCode).not.toHaveBeenCalled();
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

  test("POST /punishments stamps service actor API-key requests with owner actor", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.punishment.createPunishment.mockResolvedValue({
      id: ids.punishment,
      type: "warn",
      subjectActorId: ids.actor,
      issuerActorId: ids.apiKeyOwnerActor,
    });

    const response = await request
      .post("/punishments")
      .set("Authorization", "ApiKey service-actor-token")
      .send({ type: "warn", subjectActorId: ids.actor, reason: "Testing" });

    expect(response.status).toBe(201);
    expect(dependencies.services.punishment.createPunishment).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "warn",
        subjectActorId: ids.actor,
      }),
      ids.apiKeyOwnerActor,
    );
    expect(dependencies.authRepository.insertAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ids.apiKeyOwnerActor,
        subjectActorId: ids.apiKeyOwnerActor,
        principalType: "service_actor_api_key",
        principalId: "service-actor-key-1",
      }),
    );
  });

  test("POST /punishments requires resolved actor for server API-key requests", async () => {
    const { dependencies, request } = createTestApp();

    const response = await request
      .post("/punishments")
      .set("Authorization", "ApiKey server-token")
      .send({ type: "warn", subjectActorId: ids.actor, reason: "Testing" });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "ACTOR_REQUIRED",
      },
    });
    expect(dependencies.services.punishment.createPunishment).not.toHaveBeenCalled();
  });
});

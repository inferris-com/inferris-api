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

  test("POST /punishments stamps API-key requests with acting actor", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.punishment.createPunishment.mockResolvedValue({
      id: ids.punishment,
      type: "warn",
      subjectActorId: ids.actor,
      issuerActorId: ids.actingActor,
    });

    const response = await request
      .post("/punishments")
      .set("Authorization", "ApiKey server-token")
      .set("X-Inferris-Actor-Id", ids.actingActor)
      .send({ type: "warn", subjectActorId: ids.actor, reason: "Testing" });

    expect(response.status).toBe(201);
    expect(dependencies.authRepository.actorExists).toHaveBeenCalledWith(ids.actingActor);
    expect(dependencies.services.punishment.createPunishment).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "warn",
        subjectActorId: ids.actor,
      }),
      ids.actingActor,
    );
    expect(dependencies.authRepository.insertAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ids.actingActor,
        subjectActorId: ids.apiKeyOwnerActor,
        principalType: "server_api_key",
        principalId: "server-key-1",
      }),
    );
  });

  test("POST /punishments requires acting actor for API-key requests", async () => {
    const { dependencies, request } = createTestApp();

    const response = await request
      .post("/punishments")
      .set("Authorization", "ApiKey server-token")
      .send({ type: "warn", subjectActorId: ids.actor, reason: "Testing" });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "ACTING_ACTOR_REQUIRED",
      },
    });
    expect(dependencies.services.punishment.createPunishment).not.toHaveBeenCalled();
  });

  test("POST /punishments rejects malformed acting actor", async () => {
    const { dependencies, request } = createTestApp();

    const response = await request
      .post("/punishments")
      .set("Authorization", "ApiKey server-token")
      .set("X-Inferris-Actor-Id", "not-a-uuid")
      .send({ type: "warn", subjectActorId: ids.actor, reason: "Testing" });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "INVALID_ACTING_ACTOR",
      },
    });
    expect(dependencies.authRepository.actorExists).not.toHaveBeenCalled();
    expect(dependencies.services.punishment.createPunishment).not.toHaveBeenCalled();
  });

  test("POST /punishments rejects unknown acting actor", async () => {
    const { dependencies, request } = createTestApp();

    const response = await request
      .post("/punishments")
      .set("Authorization", "ApiKey server-token")
      .set("X-Inferris-Actor-Id", ids.unknownActor)
      .send({ type: "warn", subjectActorId: ids.actor, reason: "Testing" });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        code: "ACTING_ACTOR_NOT_FOUND",
      },
    });
    expect(dependencies.services.punishment.createPunishment).not.toHaveBeenCalled();
  });

  test("POST /punishments rejects acting actor header for bearer requests", async () => {
    const { dependencies, request } = createTestApp();

    const response = await request
      .post("/punishments")
      .set("Authorization", "Bearer moderator-token")
      .set("X-Inferris-Actor-Id", ids.actingActor)
      .send({ type: "warn", subjectActorId: ids.actor, reason: "Testing" });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "ACTING_ACTOR_HEADER_NOT_ALLOWED",
      },
    });
    expect(dependencies.services.punishment.createPunishment).not.toHaveBeenCalled();
  });
});

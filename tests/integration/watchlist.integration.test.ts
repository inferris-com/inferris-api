import { describe, expect, test } from "@jest/globals";

import { createTestApp, ids } from "@tests/integration/app-test-utils.js";

describe("watchlist routes", () => {
  test("GET /watchlist forwards filters to the service", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.watchlist.listEntries.mockResolvedValue({
      data: [
        {
          id: ids.watchlist,
          subjectActorId: ids.actor,
          severity: "high",
          reason: "Testing",
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
      .get("/watchlist?active=true&severity=high")
      .set("Authorization", "Bearer moderator-token");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      meta: {
        count: 1,
        total: 1,
      },
    });
    expect(dependencies.services.watchlist.listEntries).toHaveBeenCalledWith(
      expect.objectContaining({
        active: true,
        severity: "high",
      }),
    );
  });

  test("POST /watchlist stamps service actor API-key owner and audits the mutation", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.watchlist.addEntry.mockResolvedValue({
      id: ids.watchlist,
      subjectActorId: ids.actor,
      severity: "medium",
      reason: "Testing",
    });

    const response = await request
      .post("/watchlist")
      .set("Authorization", "ApiKey service-actor-token")
      .send({
        subjectActorId: ids.actor,
        reason: "Testing",
        severity: "medium",
      });

    expect(response.status).toBe(201);
    expect(dependencies.services.watchlist.addEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectActorId: ids.actor,
        reason: "Testing",
        severity: "medium",
      }),
      ids.apiKeyOwnerActor,
    );
    expect(dependencies.authRepository.insertAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ids.apiKeyOwnerActor,
        subjectActorId: ids.apiKeyOwnerActor,
        action: "watchlist.add",
      }),
    );
  });

  test("POST /watchlist/clear clears by acting actor", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.watchlist.clearEntry.mockResolvedValue({
      id: ids.watchlist,
      subjectActorId: ids.actor,
      clearedByActorId: ids.actor,
    });

    const response = await request
      .post("/watchlist/clear")
      .set("Authorization", "Bearer moderator-token")
      .send({ subjectActorId: ids.actor, reason: "Resolved" });

    expect(response.status).toBe(200);
    expect(dependencies.services.watchlist.clearEntry).toHaveBeenCalledWith(
      {
        subjectActorId: ids.actor,
        reason: "Resolved",
      },
      ids.actor,
    );
  });
});

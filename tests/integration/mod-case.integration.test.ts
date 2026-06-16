import { describe, expect, test } from "@jest/globals";

import { createTestApp, ids } from "./app-test-utils.js";

describe("mod case routes", () => {
  test("POST /mod-cases uses API-key acting actor", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.modCase.createModCase.mockResolvedValue({
      id: ids.modCase,
      title: "Spawn griefing",
      openedByActorId: ids.actingActor,
    });

    const response = await request
      .post("/mod-cases")
      .set("Authorization", "ApiKey server-token")
      .set("X-Inferris-Actor-Id", ids.actingActor)
      .send({ title: "Spawn griefing" });

    expect(response.status).toBe(201);
    expect(dependencies.services.modCase.createModCase).toHaveBeenCalledWith(
      {
        title: "Spawn griefing",
        isSticky: false,
        actors: [],
      },
      ids.actingActor,
    );
  });

  test("PATCH /mod-cases/:caseId uses API-key acting actor", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.modCase.updateModCase.mockResolvedValue({
      id: ids.modCase,
      status: "closed",
      closedByActorId: ids.actingActor,
    });

    const response = await request
      .patch(`/mod-cases/${ids.modCase}`)
      .set("Authorization", "ApiKey server-token")
      .set("X-Inferris-Actor-Id", ids.actingActor)
      .send({ status: "closed", resolution: "action_taken" });

    expect(response.status).toBe(200);
    expect(dependencies.services.modCase.updateModCase).toHaveBeenCalledWith(
      ids.modCase,
      {
        status: "closed",
        resolution: "action_taken",
      },
      ids.actingActor,
    );
  });

  test("POST /mod-cases/:caseId/actors uses API-key acting actor", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.modCase.createActor.mockResolvedValue({
      caseId: ids.modCase,
      actorId: ids.actor,
      addedByActorId: ids.actingActor,
    });

    const response = await request
      .post(`/mod-cases/${ids.modCase}/actors`)
      .set("Authorization", "ApiKey server-token")
      .set("X-Inferris-Actor-Id", ids.actingActor)
      .send({ actorId: ids.actor, role: "subject" });

    expect(response.status).toBe(201);
    expect(dependencies.services.modCase.createActor).toHaveBeenCalledWith(
      ids.modCase,
      {
        actorId: ids.actor,
        role: "subject",
      },
      ids.actingActor,
    );
  });
});

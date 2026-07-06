import { describe, expect, test } from "@jest/globals";

import { createTestApp, ids } from "./app-test-utils.js";

describe("report routes", () => {
  test("PATCH /reports/:reportId uses service actor API-key owner", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.report.updateReport.mockResolvedValue({
      id: ids.report,
      status: "actioned",
      triagedByActorId: ids.apiKeyOwnerActor,
      closedByActorId: ids.apiKeyOwnerActor,
    });

    const response = await request
      .patch(`/reports/${ids.report}`)
      .set("Authorization", "ApiKey service-actor-token")
      .send({ status: "actioned", resolution: "action_taken" });

    expect(response.status).toBe(200);
    expect(dependencies.services.report.updateReport).toHaveBeenCalledWith(
      ids.report,
      {
        status: "actioned",
        resolution: "action_taken",
      },
      ids.apiKeyOwnerActor,
    );
  });

  test("POST /reports/:reportId/comments uses service actor API-key owner", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.report.createComment.mockResolvedValue({
      id: "comment-1",
      reportId: ids.report,
      authorActorId: ids.apiKeyOwnerActor,
      commentText: "Reviewed in-game.",
    });

    const response = await request
      .post(`/reports/${ids.report}/comments`)
      .set("Authorization", "ApiKey service-actor-token")
      .send({ commentText: "Reviewed in-game." });

    expect(response.status).toBe(201);
    expect(dependencies.services.report.createComment).toHaveBeenCalledWith(
      ids.report,
      {
        commentText: "Reviewed in-game.",
        isSticky: false,
      },
      ids.apiKeyOwnerActor,
    );
  });
});

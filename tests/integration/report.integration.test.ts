import { describe, expect, test } from "@jest/globals";

import { createTestApp, ids } from "./app-test-utils.js";

describe("report routes", () => {
  test("GET /reports/code/:code resolves report by portable code", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.report.getReportByCode.mockResolvedValue({
      id: ids.report,
      code: "RP12CD34EF",
      status: "open",
    });

    const response = await request
      .get("/reports/code/RP12CD34EF")
      .set("Authorization", "Bearer moderator-token");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      data: {
        id: ids.report,
        code: "RP12CD34EF",
      },
    });
    expect(dependencies.services.report.getReportByCode).toHaveBeenCalledWith("RP12CD34EF");
    expect(dependencies.services.report.getReport).not.toHaveBeenCalled();
  });

  test("GET /reports/code/:code validates portable code format", async () => {
    const { dependencies, request } = createTestApp();

    const response = await request
      .get("/reports/code/rp-123")
      .set("Authorization", "Bearer moderator-token");

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
      },
    });
    expect(dependencies.services.report.getReportByCode).not.toHaveBeenCalled();
  });

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
      undefined,
    );
  });

  test("PATCH /reports/:reportId/comments/:commentId lets moderators edit as self only", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.report.updateComment.mockResolvedValue({
      id: ids.chatMessage,
      reportId: ids.report,
      authorActorId: ids.actor,
      commentText: "Updated.",
      editedAtMs: "1000",
    });

    const response = await request
      .patch(`/reports/${ids.report}/comments/${ids.chatMessage}`)
      .set("Authorization", "Bearer moderator-token")
      .send({ commentText: "Updated." });

    expect(response.status).toBe(200);
    expect(dependencies.services.report.updateComment).toHaveBeenCalledWith(
      ids.report,
      ids.chatMessage,
      {
        commentText: "Updated.",
      },
      ids.actor,
      false,
    );
  });

  test("DELETE /reports/:reportId/comments/:commentId lets admins delete other comments", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.report.deleteComment.mockResolvedValue(undefined);

    const response = await request
      .delete(`/reports/${ids.report}/comments/${ids.chatMessage}`)
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(204);
    expect(dependencies.services.report.deleteComment).toHaveBeenCalledWith(
      ids.report,
      ids.chatMessage,
      ids.actor,
      "argus-admin",
      true,
    );
  });
});

import { describe, expect, test } from "@jest/globals";

import { createTestApp } from "@tests/integration/app-test-utils.js";

describe("argus alert routes", () => {
  test("GET /argus-alerts forwards filters to the service", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.argusAlert.listAlerts.mockResolvedValue({
      rows: [
        {
          id: 1,
          title: "Maintenance",
          description: "Argus maintenance is scheduled.",
          priority: 10,
          cssClass: "alert-warning",
          isActive: true,
          createdAtMs: "1000",
        },
      ],
      total: 1,
      limit: 25,
      offset: 0,
    });

    const response = await request
      .get("/argus-alerts?isActive=true")
      .set("Authorization", "Bearer moderator-token");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      data: [{ id: 1, title: "Maintenance" }],
      meta: { count: 1, total: 1, limit: 25, offset: 0 },
    });
    expect(dependencies.services.argusAlert.listAlerts).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true }),
    );
  });

  test("POST /argus-alerts creates and audits by admin", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.argusAlert.createAlert.mockResolvedValue({
      id: 2,
      title: "Deploy",
      description: null,
      priority: 5,
      cssClass: null,
      isActive: true,
      createdAtMs: "2000",
    });

    const response = await request
      .post("/argus-alerts")
      .set("Authorization", "Bearer admin-token")
      .send({ title: "Deploy", priority: 5 });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ data: { id: 2, title: "Deploy" } });
    expect(dependencies.services.argusAlert.createAlert).toHaveBeenCalledWith({
      title: "Deploy",
      priority: 5,
      isActive: true,
    });
    expect(dependencies.authRepository.insertAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "argus-alerts.create",
      }),
    );
  });

  test("PATCH /argus-alerts/:alertId rejects moderator writes", async () => {
    const { dependencies, request } = createTestApp();

    const response = await request
      .patch("/argus-alerts/1")
      .set("Authorization", "Bearer moderator-token")
      .send({ priority: 30 });

    expect(response.status).toBe(403);
    expect(dependencies.services.argusAlert.updateAlert).not.toHaveBeenCalled();
  });
});

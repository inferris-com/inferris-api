import { describe, expect, test } from "@jest/globals";

import { createTestApp } from "./app-test-utils.js";

describe("permission routes", () => {
  test("GET /permissions/:permissionKey returns a permission node", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.permission.findPermissionByKey.mockResolvedValue({
      id: "permission-1",
      key: "server.access.*",
      category: "administration",
      isActive: true,
    });

    const response = await request
      .get("/permissions/server.access.*")
      .set("Authorization", "Bearer moderator-token");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      data: {
        key: "server.access.*",
      },
    });
    expect(dependencies.services.permission.findPermissionByKey).toHaveBeenCalledWith(
      "server.access.*",
    );
  });

  test("POST /permissions requires administrator privilege", async () => {
    const { dependencies, request } = createTestApp();

    const response = await request
      .post("/permissions")
      .set("Authorization", "Bearer moderator-token")
      .send({
        key: "server.lockdown.bypass",
        description: null,
        category: "administration",
        isActive: true,
      });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      error: {
        code: "FORBIDDEN",
      },
    });
    expect(dependencies.services.permission.createPermissionNode).not.toHaveBeenCalled();
  });

  test("PUT /permissions/:permissionKey/rules/:minRankKey replaces a rule", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.permission.replacePermissionRule.mockResolvedValue({
      permissionKey: "server.access.*",
      minRankKey: "admin",
      effect: "allow",
    });

    const response = await request
      .put("/permissions/server.access.*/rules/admin")
      .set("Authorization", "Bearer admin-token")
      .send({ effect: "allow" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      data: {
        effect: "allow",
      },
    });
    expect(dependencies.services.permission.replacePermissionRule).toHaveBeenCalledWith(
      "server.access.*",
      "admin",
      { effect: "allow" },
    );
  });
});

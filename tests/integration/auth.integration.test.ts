import { describe, expect, test } from "@jest/globals";

import { createTestApp, ids } from "./app-test-utils.js";

describe("auth routes", () => {
  test("GET /auth/me rejects missing credentials", async () => {
    const { request } = createTestApp();

    const response = await request.get("/auth/me");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Missing authentication credentials",
      },
    });
  });

  test("GET /auth/me returns the current Argus identity", async () => {
    const { dependencies, request } = createTestApp();

    const response = await request.get("/auth/me").set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        id: "argus-admin",
        username: "Admin",
        role: "admin",
        actorId: ids.actor,
        privilegedRole: "superadmin",
      },
    });
    expect(dependencies.services.auth.getCurrentUser).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ids.actor,
        argus: expect.objectContaining({ userId: "argus-admin", role: "admin" }),
      }),
    );
  });
});

import { describe, expect, jest, test } from "@jest/globals";

import { createTestApp, createTestDependencies, ids } from "@tests/integration/app-test-utils.js";

describe("auth routes", () => {
  test("server requests authenticate once", async () => {
    const dependencies = createTestDependencies();
    const authenticateRequest = jest.fn(dependencies.authenticateRequest);
    dependencies.authenticateRequest = authenticateRequest;
    dependencies.services.server.listServers.mockResolvedValue([]);
    const { request } = createTestApp(dependencies);
    const response = await request.get("/servers").set("Authorization", "ApiKey server-token");
    expect(response.status).toBe(200);
    expect(authenticateRequest).toHaveBeenCalledTimes(1);
  });
  test("POST /auth/login returns token data without embedding the account", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.auth.login.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      tokenType: "Bearer",
      expiresInSeconds: 900,
    });

    const response = await request.post("/auth/login").send({
      usernameOrEmail: "Developer",
      password: "dev",
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      data: {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        tokenType: "Bearer",
        expiresInSeconds: 900,
      },
    });
  });
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
        email: "admin@example.com",
        role: "admin",
        actorId: ids.actor,
        accountState: "active",
        accountSecurityLock: null,
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

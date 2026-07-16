import { describe, expect, test } from "@jest/globals";

import { createTestApp, ids } from "./app-test-utils.js";

describe("argus user routes", () => {
  test("GET /argus-users/resolve lets moderators resolve recipients", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.argusUser.resolveUsers.mockResolvedValue([
      {
        id: ids.argusDmConversation,
        username: "SecondMod",
        email: "second@example.com",
        role: "moderator",
        actorId: null,
        accountState: "active",
        accountSecurityLock: null,
        createdAtMs: "1000",
        updatedAtMs: null,
      },
    ]);

    const response = await request
      .get("/argus-users/resolve?q=Second&limit=5")
      .set("Authorization", "Bearer moderator-token");

    expect(response.status).toBe(200);
    expect(dependencies.services.argusUser.resolveUsers).toHaveBeenCalledWith({
      q: "Second",
      limit: 5,
    });
  });
});

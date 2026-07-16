import { describe, expect, test } from "@jest/globals";

import { createTestApp, ids } from "./app-test-utils.js";

const previousSessionId = "11111111-1111-4111-8111-111111111111";

describe("account routes", () => {
  test("GET /account/sessions returns current and historical Argus sessions", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.account.listSessions.mockResolvedValue([
      {
        id: ids.chatMessage,
        createdAtMs: 1_800_000_000_000,
        lastSeenAtMs: 1_800_000_010_000,
        expiresAtMs: 1_800_086_400_000,
        revokedAtMs: null,
        isCurrent: true,
        ipAddress: "203.0.113.10",
        userAgent: "Argus Test",
      },
      {
        id: previousSessionId,
        createdAtMs: 1_799_000_000_000,
        lastSeenAtMs: 1_799_000_010_000,
        expiresAtMs: 1_799_086_400_000,
        revokedAtMs: 1_799_000_020_000,
        isCurrent: false,
        ipAddress: null,
        userAgent: null,
      },
    ]);

    const response = await request.get("/account/sessions").set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [
        {
          id: ids.chatMessage,
          createdAtMs: 1_800_000_000_000,
          lastSeenAtMs: 1_800_000_010_000,
          expiresAtMs: 1_800_086_400_000,
          revokedAtMs: null,
          isCurrent: true,
          ipAddress: "203.0.113.10",
          userAgent: "Argus Test",
        },
        {
          id: previousSessionId,
          createdAtMs: 1_799_000_000_000,
          lastSeenAtMs: 1_799_000_010_000,
          expiresAtMs: 1_799_086_400_000,
          revokedAtMs: 1_799_000_020_000,
          isCurrent: false,
          ipAddress: null,
          userAgent: null,
        },
      ],
      meta: { count: 2 },
    });
    expect(dependencies.services.account.listSessions).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ids.actor,
        argus: { userId: "argus-admin", role: "admin", sessionId: ids.chatMessage },
      }),
    );
  });

  test("DELETE /account/sessions/:sessionId revokes an Argus session", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.account.revokeSession.mockResolvedValue(undefined);

    const response = await request
      .delete(`/account/sessions/${previousSessionId}`)
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(204);
    expect(dependencies.services.account.revokeSession).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ids.actor,
        argus: { userId: "argus-admin", role: "admin", sessionId: ids.chatMessage },
      }),
      previousSessionId,
    );
  });
});

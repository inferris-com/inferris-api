import { describe, expect, test } from "@jest/globals";

import type { ApiScope } from "@/module/auth/auth.types.js";
import {
  createTestApp,
  createTestDependencies,
  type TestDependencies,
} from "@tests/integration/app-test-utils.js";

const routes = [
  {
    path: "/punishments",
    service: "punishment",
    method: "listPunishments",
    scope: "moderation:read",
  },
  { path: "/reports", service: "report", method: "listReports", scope: "moderation:read" },
  { path: "/chat-messages", service: "chatMessage", method: "listMessages", scope: "chat:read" },
] as const;

function listMock(dependencies: TestDependencies, route: (typeof routes)[number]) {
  switch (route.service) {
    case "punishment":
      return dependencies.services.punishment.listPunishments;
    case "report":
      return dependencies.services.report.listReports;
    case "chatMessage":
      return dependencies.services.chatMessage.listMessages;
  }
}

function scopedApp(route: (typeof routes)[number], scopes: ApiScope[]) {
  const dependencies = createTestDependencies();
  dependencies.authenticateRequest = (req, _res, next) => {
    req.auth = {
      principalType: "server_api_key",
      principalId: "list-test-key",
      actorId: null,
      platform: "minecraft",
      apiKey: { id: "list-test-key", scopes, isSuperKey: false },
    };
    next();
  };
  const list = listMock(dependencies, route);
  list.mockResolvedValue({ data: [], meta: { count: 0, total: 0, limit: 25, offset: 0 } });
  return { ...createTestApp(dependencies), list };
}

describe.each(routes)("$path identity expansion", (route) => {
  test("preserves the base list contract for keys without identity scopes", async () => {
    const { request, list } = scopedApp(route, [route.scope]);
    const response = await request.get(route.path);
    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith(expect.not.objectContaining({ include: "identities" }));
  });

  test.each([
    { scopes: [] as ApiScope[] },
    { scopes: ["actors:read"] as ApiScope[] },
    { scopes: ["players:read"] as ApiScope[] },
  ])(
    "requires both identity scopes in addition to the list scope ($scopes)",
    async ({ scopes }) => {
      const { request, list } = scopedApp(route, [route.scope, ...scopes]);
      const response = await request.get(`${route.path}?include=identities`);
      expect(response.status).toBe(403);
      expect(list).not.toHaveBeenCalled();
    },
  );

  test("expands for a fully scoped key", async () => {
    const { request, list } = scopedApp(route, [route.scope, "actors:read", "players:read"]);
    expect((await request.get(`${route.path}?include=identities`)).status).toBe(200);
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ include: "identities" }));
  });

  test("preserves moderator access", async () => {
    const { dependencies, request } = createTestApp();
    const list = listMock(dependencies, route);
    list.mockResolvedValue({ data: [], meta: { count: 0, total: 0, limit: 25, offset: 0 } });
    expect(
      (
        await request
          .get(`${route.path}?include=identities`)
          .set("Authorization", "Bearer moderator-token")
      ).status,
    ).toBe(200);
  });

  test("passes asynchronous authorization failures to Express", async () => {
    const { dependencies, request, list } = scopedApp(route, [route.scope]);
    dependencies.authRepository.insertAuditLog.mockRejectedValue(new Error("Audit unavailable"));
    expect((await request.get(`${route.path}?include=identities`)).status).toBe(500);
    expect(list).not.toHaveBeenCalled();
  });
});

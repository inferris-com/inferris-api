import { describe, expect, test } from "@jest/globals";

import { createTestApp } from "@tests/integration/app-test-utils.js";

describe("player connection routes", () => {
  test("GET /player-connections is removed", async () => {
    const { request } = createTestApp();

    const response = await request
      .get("/player-connections")
      .set("Authorization", "ApiKey server-token");

    expect(response.status).toBe(404);
  });
});

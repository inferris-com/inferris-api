import { describe, expect, test } from "@jest/globals";

import { createTestApp } from "@tests/integration/app-test-utils.js";

describe("backend session routes", () => {
  test("GET /server-visits is removed", async () => {
    const { request } = createTestApp();

    const response = await request
      .get("/server-visits")
      .set("Authorization", "ApiKey server-token");

    expect(response.status).toBe(404);
  });
});

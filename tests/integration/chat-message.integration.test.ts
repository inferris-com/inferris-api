import { describe, expect, test } from "@jest/globals";

import { createTestApp, ids } from "@tests/integration/app-test-utils.js";

describe("chat message routes", () => {
  test("POST /chat-messages forwards explicit moderation verdict fields", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.chatMessage.createMessage.mockResolvedValue({
      id: ids.chatMessage,
      actorId: ids.actor,
      originServerId: ids.server,
      channelKey: "global",
      message: "blocked.example",
      verdict: "deny",
      moderationReason: "advertisement",
      moderationMetadata: { source: "paper-chat" },
      isFlagged: true,
    });

    const response = await request
      .post("/chat-messages")
      .set("Authorization", "ApiKey server-token")
      .send({
        producerMessageId: "paper-1",
        actorId: ids.actor,
        originServerId: ids.server,
        channelKey: "global",
        message: "blocked.example",
        verdict: "deny",
        moderationReason: "advertisement",
        moderationMetadata: { source: "paper-chat" },
        isFlagged: true,
      });

    expect(response.status).toBe(202);
    expect(dependencies.services.chatMessage.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        producerMessageId: "paper-1",
        actorId: ids.actor,
        verdict: "deny",
        moderationReason: "advertisement",
        moderationMetadata: { source: "paper-chat" },
        isFlagged: true,
      }),
    );
    expect(response.body).toMatchObject({
      data: {
        verdict: "deny",
        moderationReason: "advertisement",
        isFlagged: true,
      },
    });
  });

  test("GET /chat-messages supports verdict filtering", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.chatMessage.listMessages.mockResolvedValue({
      data: [],
      meta: {
        count: 0,
        limit: 100,
      },
    });

    const response = await request
      .get("/chat-messages?verdict=deny")
      .set("Authorization", "Bearer moderator-token");

    expect(response.status).toBe(200);
    expect(dependencies.services.chatMessage.listMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        verdict: "deny",
      }),
    );
  });
});

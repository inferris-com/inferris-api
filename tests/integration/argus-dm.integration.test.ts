import { describe, expect, test } from "@jest/globals";

import { createTestApp, ids } from "@tests/integration/app-test-utils.js";

describe("argus DM routes", () => {
  test("POST /argus-dms creates a conversation as the current Argus user", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.argusDm.createConversation.mockResolvedValue({
      id: ids.argusDmConversation,
      title: "Staff sync",
      ownerArgusUserId: "argus-moderator",
      participants: [],
      isUnread: false,
      unreadMessageCount: 0,
      lastReadAtMs: "1000",
      latestMessage: null,
      createdAtMs: "1000",
      updatedAtMs: null,
    });

    const response = await request
      .post("/argus-dms")
      .set("Authorization", "Bearer moderator-token")
      .send({
        title: "Staff sync",
        recipientArgusUserIds: ["00000000-0000-0000-0000-0000000000aa"],
        body: "**Initial note**",
      });

    expect(response.status).toBe(201);
    expect(dependencies.services.argusDm.createConversation).toHaveBeenCalledWith(
      {
        title: "Staff sync",
        recipientArgusUserIds: ["00000000-0000-0000-0000-0000000000aa"],
        body: "**Initial note**",
      },
      "argus-moderator",
    );
  });

  test("GET /argus-dms/:conversationId/messages scopes reads to current participant", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.argusDm.listMessages.mockResolvedValue([
      {
        id: ids.argusDmMessage,
        conversationId: ids.argusDmConversation,
        authorArgusUserId: "argus-moderator",
        body: "Hello",
        isDeleted: false,
        createdAtMs: "1000",
        editedAtMs: null,
        deletedAtMs: null,
        deletedByArgusUserId: null,
      },
    ]);

    const response = await request
      .get(`/argus-dms/${ids.argusDmConversation}/messages`)
      .set("Authorization", "Bearer moderator-token");

    expect(response.status).toBe(200);
    expect(dependencies.services.argusDm.listMessages).toHaveBeenCalledWith(
      ids.argusDmConversation,
      "argus-moderator",
    );
  });

  test("GET /argus-dms/unread-count returns current user unread conversation count", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.argusDm.getUnreadCount.mockResolvedValue({ unreadConversations: 3 });

    const response = await request
      .get("/argus-dms/unread-count")
      .set("Authorization", "Bearer moderator-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { unreadConversations: 3 } });
    expect(dependencies.services.argusDm.getUnreadCount).toHaveBeenCalledWith("argus-moderator");
  });

  test("POST /argus-dms/:conversationId/read marks conversation read", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.argusDm.markConversationRead.mockResolvedValue(undefined);

    const response = await request
      .post(`/argus-dms/${ids.argusDmConversation}/read`)
      .set("Authorization", "Bearer moderator-token");

    expect(response.status).toBe(204);
    expect(dependencies.services.argusDm.markConversationRead).toHaveBeenCalledWith(
      ids.argusDmConversation,
      "argus-moderator",
    );
  });

  test("PATCH /argus-dms/:conversationId/messages/:messageId edits as current Argus user", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.argusDm.updateMessage.mockResolvedValue({
      id: ids.argusDmMessage,
      conversationId: ids.argusDmConversation,
      authorArgusUserId: "argus-moderator",
      body: "Edited",
      isDeleted: false,
      createdAtMs: "1000",
      editedAtMs: "2000",
      deletedAtMs: null,
      deletedByArgusUserId: null,
    });

    const response = await request
      .patch(`/argus-dms/${ids.argusDmConversation}/messages/${ids.argusDmMessage}`)
      .set("Authorization", "Bearer moderator-token")
      .send({ body: "Edited" });

    expect(response.status).toBe(200);
    expect(dependencies.services.argusDm.updateMessage).toHaveBeenCalledWith(
      ids.argusDmConversation,
      ids.argusDmMessage,
      { body: "Edited" },
      "argus-moderator",
    );
  });

  test("DELETE /argus-dms/:conversationId/messages/:messageId passes admin role to service", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.argusDm.deleteMessage.mockResolvedValue(undefined);

    const response = await request
      .delete(`/argus-dms/${ids.argusDmConversation}/messages/${ids.argusDmMessage}`)
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(204);
    expect(dependencies.services.argusDm.deleteMessage).toHaveBeenCalledWith(
      ids.argusDmConversation,
      ids.argusDmMessage,
      "argus-admin",
      "admin",
    );
  });

  test("POST /argus-dms/:conversationId/leave removes current participant", async () => {
    const { dependencies, request } = createTestApp();
    dependencies.services.argusDm.leaveConversation.mockResolvedValue(undefined);

    const response = await request
      .post(`/argus-dms/${ids.argusDmConversation}/leave`)
      .set("Authorization", "Bearer moderator-token");

    expect(response.status).toBe(204);
    expect(dependencies.services.argusDm.leaveConversation).toHaveBeenCalledWith(
      ids.argusDmConversation,
      "argus-moderator",
    );
  });
});

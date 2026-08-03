import { describe, expect, jest, test } from "@jest/globals";

import {
  ArgusDmForbiddenError,
  ArgusDmValidationError,
} from "@/module/argus/argus-dm/argus-dm.errors.js";
import { ArgusDmService } from "@/module/argus/argus-dm/argus-dm.service.js";

const conversation = {
  id: "00000000-0000-0000-0000-00000000000c",
  title: "Staff sync",
  owner_argus_user_id: "owner",
  created_at_ms: 1000,
  updated_at_ms: null,
};

function createRepo(overrides: Record<string, unknown> = {}) {
  return {
    listConversations: jest.fn(),
    findConversationForParticipant: jest.fn().mockResolvedValue(conversation),
    listActiveParticipants: jest.fn().mockResolvedValue([]),
    listLatestMessages: jest.fn().mockResolvedValue([]),
    createConversation: jest.fn().mockResolvedValue(conversation),
    updateConversation: jest.fn().mockResolvedValue(conversation),
    leaveConversation: jest.fn().mockResolvedValue(true),
    markConversationRead: jest.fn().mockResolvedValue(true),
    countUnreadConversations: jest.fn().mockResolvedValue(0),
    countUnreadMessages: jest.fn().mockResolvedValue([]),
    listMessages: jest.fn().mockResolvedValue([]),
    findMessageById: jest.fn(),
    createMessage: jest.fn(),
    updateMessage: jest.fn(),
    deleteMessage: jest.fn(),
    listExistingActiveUserIds: jest.fn().mockResolvedValue(["owner", "recipient"]),
    findArgusUserById: jest.fn(),
    ...overrides,
  };
}

describe("ArgusDmService", () => {
  test("requires at least one recipient other than the owner", async () => {
    const repo = createRepo();
    const service = new ArgusDmService(repo as never);

    await expect(
      service.createConversation(
        {
          title: "Self",
          recipientArgusUserIds: ["owner"],
        },
        "owner",
      ),
    ).rejects.toBeInstanceOf(ArgusDmValidationError);

    expect(repo.createConversation).not.toHaveBeenCalled();
  });

  test("lets the owner invite recipients", async () => {
    const repo = createRepo();
    const service = new ArgusDmService(repo as never);

    await service.updateConversation(
      conversation.id,
      { addRecipientArgusUserIds: ["recipient"] },
      "owner",
      "moderator",
    );

    expect(repo.updateConversation).toHaveBeenCalledWith(
      conversation.id,
      { addRecipientArgusUserIds: ["recipient"] },
      "owner",
    );
  });

  test("blocks non-owner moderators from managing conversation details", async () => {
    const repo = createRepo();
    const service = new ArgusDmService(repo as never);

    await expect(
      service.updateConversation(conversation.id, { title: "Nope" }, "recipient", "moderator"),
    ).rejects.toBeInstanceOf(ArgusDmForbiddenError);

    expect(repo.updateConversation).not.toHaveBeenCalled();
  });

  test("blocks moderators from deleting DM messages", async () => {
    const repo = createRepo();
    const service = new ArgusDmService(repo as never);

    await expect(
      service.deleteMessage(
        conversation.id,
        "00000000-0000-0000-0000-00000000000d",
        "owner",
        "moderator",
      ),
    ).rejects.toBeInstanceOf(ArgusDmForbiddenError);

    expect(repo.deleteMessage).not.toHaveBeenCalled();
  });

  test("lets authors edit their own messages", async () => {
    const message = {
      id: "00000000-0000-0000-0000-00000000000d",
      conversation_id: conversation.id,
      author_argus_user_id: "owner",
      body: "Edited",
      created_at_ms: 1000,
      edited_at_ms: 2000,
      deleted_at_ms: null,
      deleted_by_argus_user_id: null,
    };
    const repo = createRepo({
      findMessageById: jest.fn().mockResolvedValue({ ...message, body: "Original" }),
      updateMessage: jest.fn().mockResolvedValue(message),
    });
    const service = new ArgusDmService(repo as never);

    await service.updateMessage(conversation.id, message.id, { body: "Edited" }, "owner");

    expect(repo.updateMessage).toHaveBeenCalledWith(conversation.id, message.id, "Edited");
  });

  test("marks conversation read when listing messages", async () => {
    const repo = createRepo();
    const service = new ArgusDmService(repo as never);

    await service.listMessages(conversation.id, "owner");

    expect(repo.markConversationRead).toHaveBeenCalledWith(conversation.id, "owner");
  });

  test("returns derived unread conversation count", async () => {
    const repo = createRepo({ countUnreadConversations: jest.fn().mockResolvedValue(2) });
    const service = new ArgusDmService(repo as never);

    await expect(service.getUnreadCount("owner")).resolves.toEqual({ unreadConversations: 2 });
  });
});

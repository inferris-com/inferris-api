import { expect, test } from "@jest/globals";

import {
  createChatMessageBatchBodySchema,
  createChatMessageBodySchema,
  listChatMessagesQuerySchema,
} from "@/module/chat-message/chat-message.schemas.js";

const actorId = "00000000-0000-0000-0000-000000000001";
const playerId = "00000000-0000-0000-0000-000000000002";
const originServerId = "00000000-0000-0000-0000-000000000003";

test("createChatMessageBodySchema requires exactly one actor identity", () => {
  const base = {
    producerMessageId: "plugin-1",
    originServerId,
    message: "hello",
  };

  expect(createChatMessageBodySchema.safeParse(base).success).toBe(false);
  expect(createChatMessageBodySchema.safeParse({ ...base, actorId, playerId }).success).toBe(false);
  expect(createChatMessageBodySchema.safeParse({ ...base, actorId }).success).toBe(true);
  expect(createChatMessageBodySchema.safeParse({ ...base, playerId }).success).toBe(true);
});

test("createChatMessageBodySchema rejects unreasonable clock skew", () => {
  const result = createChatMessageBodySchema.safeParse({
    producerMessageId: "plugin-1",
    actorId,
    originServerId,
    message: "hello",
    occurredAtMs: Date.now() - 600_000,
  });

  expect(result.success).toBe(false);
});

test("createChatMessageBatchBodySchema enforces configured batch cap", () => {
  const message = {
    producerMessageId: "plugin-1",
    actorId,
    originServerId,
    message: "hello",
  };
  const result = createChatMessageBatchBodySchema.safeParse({
    messages: Array.from({ length: 501 }, (_, index) => ({
      ...message,
      producerMessageId: `plugin-${index}`,
    })),
  });

  expect(result.success).toBe(false);
});

test("listChatMessagesQuerySchema parses includePending=false", () => {
  const result = listChatMessagesQuerySchema.parse({
    includePending: "false",
  });

  expect(result.includePending).toBe(false);
});

test("listChatMessagesQuerySchema rejects cursor with beforeMs", () => {
  const result = listChatMessagesQuerySchema.safeParse({
    cursor: "abc",
    beforeMs: "1000",
  });

  expect(result.success).toBe(false);
});

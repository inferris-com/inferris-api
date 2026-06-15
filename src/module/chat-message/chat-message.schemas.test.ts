import assert from "node:assert/strict";
import test from "node:test";

import {
  createChatMessageBatchBodySchema,
  createChatMessageBodySchema,
  listChatMessagesQuerySchema,
} from "./chat-message.schemas.js";

const actorId = "00000000-0000-0000-0000-000000000001";
const playerId = "00000000-0000-0000-0000-000000000002";
const originServerId = "00000000-0000-0000-0000-000000000003";

void test("createChatMessageBodySchema requires exactly one actor identity", () => {
  const base = {
    producerMessageId: "plugin-1",
    originServerId,
    message: "hello",
  };

  assert.equal(createChatMessageBodySchema.safeParse(base).success, false);
  assert.equal(
    createChatMessageBodySchema.safeParse({ ...base, actorId, playerId }).success,
    false,
  );
  assert.equal(createChatMessageBodySchema.safeParse({ ...base, actorId }).success, true);
  assert.equal(createChatMessageBodySchema.safeParse({ ...base, playerId }).success, true);
});

void test("createChatMessageBodySchema rejects unreasonable clock skew", () => {
  const result = createChatMessageBodySchema.safeParse({
    producerMessageId: "plugin-1",
    actorId,
    originServerId,
    message: "hello",
    occurredAtMs: Date.now() - 600_000,
  });

  assert.equal(result.success, false);
});

void test("createChatMessageBatchBodySchema enforces configured batch cap", () => {
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

  assert.equal(result.success, false);
});

void test("listChatMessagesQuerySchema parses includePending=false", () => {
  const result = listChatMessagesQuerySchema.parse({
    includePending: "false",
  });

  assert.equal(result.includePending, false);
});

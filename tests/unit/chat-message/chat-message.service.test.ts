import { expect, jest, test } from "@jest/globals";

import {
  ChatMessageService,
  mergeChatMessages,
} from "../../../src/module/chat-message/chat-message.service.js";
import type { ChatMessagePgRepository } from "../../../src/module/chat-message/chat-message.pg-repository.js";
import type { ChatMessageRedisBuffer } from "../../../src/module/chat-message/chat-message.redis-buffer.js";
import type { ChatMessageRecord } from "../../../src/module/chat-message/chat-message.types.js";

function message(
  input: Partial<ChatMessageRecord> & Pick<ChatMessageRecord, "id">,
): ChatMessageRecord {
  return {
    producerMessageId: input.producerMessageId ?? input.id,
    ingestStreamId: input.ingestStreamId ?? null,
    actorId: input.actorId ?? "00000000-0000-0000-0000-000000000001",
    playerId: input.playerId ?? null,
    originServerId: input.originServerId ?? "00000000-0000-0000-0000-000000000002",
    channelKey: input.channelKey ?? "global",
    message: input.message ?? "hello",
    verdict: input.verdict ?? "allow",
    moderationReason: input.moderationReason ?? null,
    moderationMetadata: input.moderationMetadata ?? {},
    isFlagged: input.isFlagged ?? false,
    occurredAtMs: input.occurredAtMs ?? "1000",
    persistenceState: input.persistenceState ?? "persisted",
    id: input.id,
  };
}

test("mergeChatMessages sorts by occurrence time descending and stream tie-breaker", () => {
  const merged = mergeChatMessages(
    [
      message({ id: "a", occurredAtMs: "1000", ingestStreamId: "1-0" }),
      message({ id: "b", occurredAtMs: "1200", ingestStreamId: "1-1" }),
    ],
    [
      message({
        id: "c",
        occurredAtMs: "1200",
        ingestStreamId: "2-0",
        persistenceState: "pending",
      }),
    ],
    10,
  );

  expect(merged.map((row) => row.id)).toEqual(["c", "b", "a"]);
});

test("mergeChatMessages deduplicates by message id and respects limit", () => {
  const merged = mergeChatMessages(
    [message({ id: "a", occurredAtMs: "1000" })],
    [
      message({ id: "a", occurredAtMs: "1000", persistenceState: "pending" }),
      message({ id: "b", occurredAtMs: "900", persistenceState: "pending" }),
    ],
    1,
  );

  expect(merged.map((row) => row.id)).toEqual(["a"]);
});

test("listMessages returns a stable next cursor for full pages", async () => {
  const row = message({
    id: "00000000-0000-0000-0000-000000000001",
    occurredAtMs: "1200",
    ingestStreamId: "2-0",
  });
  const repo = {
    listMessages: jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue([row]),
  } as unknown as ChatMessagePgRepository;
  const buffer = {
    listPendingMessages: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
  } as unknown as ChatMessageRedisBuffer;
  const service = new ChatMessageService(repo, buffer);

  const result = await service.listMessages({ limit: 1, includePending: false });

  expect(result.meta.nextCursor).toEqual(expect.any(String));
});

test("listMessages decodes stable cursors into repository filters", async () => {
  const row = message({
    id: "00000000-0000-0000-0000-000000000001",
    occurredAtMs: "1200",
    ingestStreamId: "2-0",
  });
  const listMessages = jest
    .fn<(...args: unknown[]) => Promise<unknown>>()
    .mockResolvedValueOnce([row])
    .mockResolvedValueOnce([]);
  const repo = {
    listMessages,
  } as unknown as ChatMessagePgRepository;
  const buffer = {
    listPendingMessages: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
  } as unknown as ChatMessageRedisBuffer;
  const service = new ChatMessageService(repo, buffer);

  const firstPage = await service.listMessages({ limit: 1, includePending: false });
  await service.listMessages({
    limit: 1,
    includePending: false,
    cursor: firstPage.meta.nextCursor ?? "",
  });

  expect(listMessages).toHaveBeenLastCalledWith({
    limit: 1,
    cursor: {
      occurredAtMs: "1200",
      ingestStreamId: "2-0",
      id: "00000000-0000-0000-0000-000000000001",
      tieBreaker: "2-0",
    },
  });
});

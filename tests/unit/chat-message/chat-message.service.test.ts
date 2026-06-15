import { expect, test } from "@jest/globals";

import { mergeChatMessages } from "../../../src/module/chat-message/chat-message.service.js";
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

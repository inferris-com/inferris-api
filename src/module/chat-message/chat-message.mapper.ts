import type { ChatMessageResponse } from "@/module/chat-message/chat-message.response-types.js";
import type { ChatMessageRecord } from "@/module/chat-message/chat-message.types.js";

export function toChatMessageResponse(row: ChatMessageRecord): ChatMessageResponse {
  return {
    id: row.id,
    producerMessageId: row.producerMessageId,
    ingestStreamId: row.ingestStreamId,
    actorId: row.actorId,
    playerId: row.playerId,
    originServerId: row.originServerId,
    channelKey: row.channelKey,
    message: row.message,
    verdict: row.verdict,
    moderationReason: row.moderationReason,
    moderationMetadata: row.moderationMetadata,
    isFlagged: row.isFlagged,
    occurredAtMs: row.occurredAtMs,
    persistenceState: row.persistenceState,
  };
}

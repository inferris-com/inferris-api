import { config } from "@/config.js";
import type { RedisClient } from "@/redis/index.js";
import type {
  BufferedChatMessage,
  ChatMessageListFilters,
  ChatMessageRecord,
  ChatMessageWriteInput,
} from "@/module/chat-message/chat-message.types.js";

const pendingPrefix = "chat:pending:";
const dedupePrefix = "chat:dedupe:";
const streamKey = "chat:messages:ingest";
const allIndexKey = "chat:pending:all";

const ingestScript = `
local existing = redis.call("GET", KEYS[1])
if existing then
  return {"duplicate", existing, ""}
end

local stream_id = redis.call("XADD", KEYS[3], "*", "messageId", ARGV[1])
local data = cjson.decode(ARGV[2])
data["ingestStreamId"] = stream_id
local payload = cjson.encode(data)

redis.call("SET", KEYS[1], ARGV[1], "EX", ARGV[4], "NX")
redis.call("HSET", KEYS[2], "payload", payload)

for i = 5, #ARGV do
  redis.call("ZADD", ARGV[i], ARGV[3], ARGV[1])
end

return {"created", ARGV[1], stream_id}
`;

const cleanupScript = `
redis.call("DEL", KEYS[1])
for i = 1, #ARGV - 1 do
  redis.call("ZREM", ARGV[i], ARGV[#ARGV])
end
return 1
`;

type EnqueueResult = {
  status: "created" | "duplicate";
  messageId: string;
  ingestStreamId: string | null;
};

export class ChatMessageRedisBuffer {
  constructor(private readonly redis: RedisClient) {}

  get streamKey(): string {
    return streamKey;
  }

  async enqueue(input: ChatMessageWriteInput): Promise<EnqueueResult> {
    const indexes = pendingIndexes(input);
    const result = parseEnqueueResult(
      await this.redis.sendCommand([
        "EVAL",
        ingestScript,
        "3",
        dedupeKey(input.originServerId, input.producerMessageId),
        pendingKey(input.id),
        streamKey,
        input.id,
        JSON.stringify(input),
        input.occurredAtMs,
        String(config.chat.dedupeTtlSeconds),
        ...indexes,
      ]),
    );

    return {
      status: result[0] === "created" ? "created" : "duplicate",
      messageId: result[1],
      ingestStreamId: result[2] || null,
    };
  }

  async getPendingMessage(messageId: string): Promise<ChatMessageRecord | null> {
    const payload = await this.redis.hGet(pendingKey(messageId), "payload");

    if (!payload) {
      return null;
    }

    return pendingPayloadToRecord(JSON.parse(payload) as BufferedChatMessage);
  }

  async listPendingMessages(filters: ChatMessageListFilters): Promise<ChatMessageRecord[]> {
    const key = narrowestIndex(filters);
    const before =
      filters.cursor !== undefined
        ? filters.cursor.occurredAtMs
        : filters.beforeMs === undefined
          ? "+inf"
          : `(${filters.beforeMs}`;
    const after = filters.afterMs === undefined ? "-inf" : String(filters.afterMs);
    const candidateLimit = String(Math.min(Math.max(filters.limit * 10, filters.limit), 2000));
    const ids = parseStringArray(
      await this.redis.sendCommand([
        "ZREVRANGEBYSCORE",
        key,
        before,
        after,
        "LIMIT",
        "0",
        candidateLimit,
      ]),
    );

    if (ids.length === 0) {
      return [];
    }

    const messages = await Promise.all(ids.map((id) => this.getPendingMessage(id)));

    return messages
      .filter((message): message is ChatMessageRecord => message !== null)
      .filter((message) => matchesFilters(message, filters))
      .slice(0, filters.limit);
  }

  async getBufferedMessages(messageIds: string[]): Promise<BufferedChatMessage[]> {
    const messages = await Promise.all(
      messageIds.map(async (messageId) => {
        const payload = await this.redis.hGet(pendingKey(messageId), "payload");
        return payload ? (JSON.parse(payload) as BufferedChatMessage) : null;
      }),
    );

    return messages.filter((message): message is BufferedChatMessage => message !== null);
  }

  async cleanup(message: BufferedChatMessage): Promise<void> {
    await this.redis.sendCommand([
      "EVAL",
      cleanupScript,
      "1",
      pendingKey(message.id),
      ...pendingIndexes(message),
      message.id,
    ]);
  }

  async ack(streamId: string): Promise<void> {
    await this.redis.xAck(streamKey, "chat-pg-writers", streamId);
  }
}

export function pendingIndexes(message: {
  channelKey: string;
  originServerId: string;
  actorId: string;
  playerId: string | null;
}): string[] {
  const indexes = [
    allIndexKey,
    `chat:pending:channel:${message.channelKey}`,
    `chat:pending:server:${message.originServerId}`,
    `chat:pending:actor:${message.actorId}`,
  ];

  if (message.playerId) {
    indexes.push(`chat:pending:player:${message.playerId}`);
  }

  return indexes;
}

function pendingKey(messageId: string): string {
  return `${pendingPrefix}${messageId}`;
}

function parseEnqueueResult(value: unknown): [string, string, string] {
  if (
    Array.isArray(value) &&
    typeof value[0] === "string" &&
    typeof value[1] === "string" &&
    typeof value[2] === "string"
  ) {
    return [value[0], value[1], value[2]];
  }

  throw new Error("Unexpected Redis chat enqueue response.");
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function dedupeKey(originServerId: string, producerMessageId: string): string {
  return `${dedupePrefix}${originServerId}:${producerMessageId}`;
}

function narrowestIndex(filters: ChatMessageListFilters): string {
  if (filters.actorId) {
    return `chat:pending:actor:${filters.actorId}`;
  }

  if (filters.playerId) {
    return `chat:pending:player:${filters.playerId}`;
  }

  if (filters.channelKey) {
    return `chat:pending:channel:${filters.channelKey}`;
  }

  if (filters.originServerId) {
    return `chat:pending:server:${filters.originServerId}`;
  }

  return allIndexKey;
}

function pendingPayloadToRecord(message: BufferedChatMessage): ChatMessageRecord {
  return {
    id: message.id,
    producerMessageId: message.producerMessageId,
    ingestStreamId: message.ingestStreamId,
    actorId: message.actorId,
    playerId: message.playerId,
    originServerId: message.originServerId,
    channelKey: message.channelKey,
    message: message.message,
    verdict: message.verdict,
    moderationReason: message.moderationReason,
    moderationMetadata: message.moderationMetadata,
    isFlagged: message.isFlagged,
    occurredAtMs: message.occurredAtMs,
    persistenceState: "pending",
  };
}

function matchesFilters(message: ChatMessageRecord, filters: ChatMessageListFilters): boolean {
  return (
    (filters.channelKey === undefined || message.channelKey === filters.channelKey) &&
    (filters.originServerId === undefined || message.originServerId === filters.originServerId) &&
    (filters.actorId === undefined || message.actorId === filters.actorId) &&
    (filters.playerId === undefined || message.playerId === filters.playerId) &&
    (filters.verdict === undefined || message.verdict === filters.verdict) &&
    (filters.cursor === undefined || isAfterCursor(message, filters.cursor))
  );
}

function isAfterCursor(
  message: ChatMessageRecord,
  cursor: NonNullable<ChatMessageListFilters["cursor"]>,
): boolean {
  const occurredDiff = BigInt(cursor.occurredAtMs) - BigInt(message.occurredAtMs);

  if (occurredDiff !== 0n) {
    return occurredDiff > 0n;
  }

  const tieBreaker = message.ingestStreamId ?? message.id;
  return tieBreaker < cursor.tieBreaker;
}

import { type Insertable, type Kysely, type Selectable, sql } from "kysely";

import type { ChatMessages, DB, JsonValue } from "../../db/types.js";
import type {
  BufferedChatMessage,
  ChatMessageListFilters,
  ChatMessageRecord,
} from "./chat-message.types.js";

type ChatMessageRow = Selectable<ChatMessages> & {
  player_id: string | null;
  verdict: "allow" | "warn" | "deny";
  moderation_reason: string | null;
  moderation_metadata: JsonValue;
};

export type InsertChatMessageInput = Insertable<ChatMessages>;

export class ChatMessagePgRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async actorExists(actorId: string): Promise<boolean> {
    const row = await this.db
      .selectFrom("actors")
      .select("id")
      .where("id", "=", actorId)
      .executeTakeFirst();

    return Boolean(row);
  }

  async serverExists(serverId: string): Promise<boolean> {
    const row = await this.db
      .selectFrom("servers")
      .select("id")
      .where("id", "=", serverId)
      .executeTakeFirst();

    return Boolean(row);
  }

  async channelExists(channelKey: string): Promise<boolean> {
    const row = await this.db
      .selectFrom("chat_channels")
      .select("key")
      .where("key", "=", channelKey)
      .executeTakeFirst();

    return Boolean(row);
  }

  async findActorIdByPlayerId(playerId: string): Promise<string | null> {
    const row = await this.db
      .selectFrom("actors")
      .select("id")
      .where("player_id", "=", playerId)
      .executeTakeFirst();

    return row?.id ?? null;
  }

  async findByProducerMessageId(
    originServerId: string,
    producerMessageId: string,
  ): Promise<ChatMessageRecord | null> {
    const row = await this.baseSelect()
      .where("chat_messages.origin_server_id", "=", originServerId)
      .where("chat_messages.producer_message_id", "=", producerMessageId)
      .executeTakeFirst();

    return row ? toPersistedRecord(row) : null;
  }

  async listMessages(filters: ChatMessageListFilters): Promise<ChatMessageRecord[]> {
    const rows = await this.baseSelect()
      .$if(filters.channelKey !== undefined, (qb) =>
        qb.where("chat_messages.channel_key", "=", filters.channelKey ?? ""),
      )
      .$if(filters.originServerId !== undefined, (qb) =>
        qb.where("chat_messages.origin_server_id", "=", filters.originServerId ?? ""),
      )
      .$if(filters.actorId !== undefined, (qb) =>
        qb.where("chat_messages.actor_id", "=", filters.actorId ?? ""),
      )
      .$if(filters.playerId !== undefined, (qb) =>
        qb.where("actors.player_id", "=", filters.playerId ?? ""),
      )
      .$if(filters.verdict !== undefined, (qb) =>
        qb.where(sql`chat_messages.verdict`, "=", filters.verdict ?? "allow"),
      )
      .$if(filters.beforeMs !== undefined, (qb) =>
        qb.where("chat_messages.created_at_ms", "<", sql<string>`${filters.beforeMs ?? 0}::bigint`),
      )
      .$if(filters.afterMs !== undefined, (qb) =>
        qb.where("chat_messages.created_at_ms", ">=", sql<string>`${filters.afterMs ?? 0}::bigint`),
      )
      .orderBy("chat_messages.created_at_ms", "desc")
      .orderBy("chat_messages.ingest_stream_id", "desc")
      .orderBy("chat_messages.id", "desc")
      .limit(filters.limit)
      .execute();

    return rows.map(toPersistedRecord);
  }

  async insertMany(messages: BufferedChatMessage[]): Promise<void> {
    if (messages.length === 0) {
      return;
    }

    await this.db
      .insertInto("chat_messages")
      .values(
        messages.map((message) => ({
          id: message.id,
          actor_id: message.actorId,
          producer_message_id: message.producerMessageId,
          ingest_stream_id: message.ingestStreamId,
          message: message.message,
          channel_key: message.channelKey,
          origin_server_id: message.originServerId,
          verdict: message.verdict,
          moderation_reason: message.moderationReason,
          moderation_metadata: JSON.stringify(message.moderationMetadata ?? {}),
          is_flagged: message.isFlagged,
          created_at_ms: sql`${message.occurredAtMs}::bigint`,
        }) as InsertChatMessageInput),
      )
      .onConflict((oc) => oc.columns(["origin_server_id", "producer_message_id"]).doNothing())
      .execute();
  }

  private baseSelect() {
    return this.db
      .selectFrom("chat_messages")
      .innerJoin("actors", "actors.id", "chat_messages.actor_id")
      .select([
        "chat_messages.id",
        "chat_messages.actor_id",
        "actors.player_id",
        "chat_messages.producer_message_id",
        "chat_messages.ingest_stream_id",
        "chat_messages.message",
        "chat_messages.channel_key",
        "chat_messages.origin_server_id",
        sql<"allow" | "warn" | "deny">`chat_messages.verdict`.as("verdict"),
        sql<string | null>`chat_messages.moderation_reason`.as("moderation_reason"),
        sql<JsonValue>`chat_messages.moderation_metadata`.as("moderation_metadata"),
        "chat_messages.is_flagged",
        "chat_messages.created_at_ms",
      ]);
  }
}

function toPersistedRecord(row: ChatMessageRow): ChatMessageRecord {
  return {
    id: row.id,
    producerMessageId: row.producer_message_id,
    ingestStreamId: row.ingest_stream_id,
    actorId: row.actor_id,
    playerId: row.player_id,
    originServerId: row.origin_server_id,
    channelKey: row.channel_key,
    message: row.message,
    verdict: row.verdict,
    moderationReason: row.moderation_reason,
    moderationMetadata: row.moderation_metadata,
    isFlagged: row.is_flagged,
    occurredAtMs: row.created_at_ms.toString(),
    persistenceState: "persisted",
  };
}

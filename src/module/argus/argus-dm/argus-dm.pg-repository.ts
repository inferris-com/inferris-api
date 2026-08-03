import { sql, type Kysely, type Selectable } from "kysely";

import type { ArgusDmConversations, ArgusDmMessages, ArgusUsers, DB } from "@/db/types.js";
import type { PaginatedResult } from "@/shared/pagination.schemas.js";
import type { ArgusDmParticipantRow } from "@/module/argus/argus-dm/argus-dm.mapper.js";
import type {
  CreateArgusDmConversationBody,
  ListArgusDmConversationsQuery,
  UpdateArgusDmConversationBody,
} from "@/module/argus/argus-dm/argus-dm.schemas.js";

export class ArgusDmPgRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async listConversations(
    argusUserId: string,
    query: ListArgusDmConversationsQuery,
  ): Promise<PaginatedResult<Selectable<ArgusDmConversations>>> {
    const baseQuery = this.db
      .selectFrom("argus_dm_conversations")
      .innerJoin(
        "argus_dm_participants",
        "argus_dm_participants.conversation_id",
        "argus_dm_conversations.id",
      )
      .where("argus_dm_participants.argus_user_id", "=", argusUserId)
      .where("argus_dm_participants.left_at_ms", "is", null);

    const [rows, totalRow] = await Promise.all([
      baseQuery
        .selectAll("argus_dm_conversations")
        .orderBy("argus_dm_conversations.updated_at_ms", "desc")
        .orderBy("argus_dm_conversations.created_at_ms", "desc")
        .limit(query.limit)
        .offset(query.offset)
        .execute(),
      baseQuery.select((eb) => eb.fn.countAll<string>().as("total")).executeTakeFirstOrThrow(),
    ]);

    return { rows, total: Number(totalRow.total), limit: query.limit, offset: query.offset };
  }

  async findConversationForParticipant(
    conversationId: string,
    argusUserId: string,
  ): Promise<Selectable<ArgusDmConversations> | null> {
    return (
      (await this.db
        .selectFrom("argus_dm_conversations")
        .innerJoin(
          "argus_dm_participants",
          "argus_dm_participants.conversation_id",
          "argus_dm_conversations.id",
        )
        .selectAll("argus_dm_conversations")
        .where("argus_dm_conversations.id", "=", conversationId)
        .where("argus_dm_participants.argus_user_id", "=", argusUserId)
        .where("argus_dm_participants.left_at_ms", "is", null)
        .executeTakeFirst()) ?? null
    );
  }

  async listActiveParticipants(conversationIds: string[]): Promise<ArgusDmParticipantRow[]> {
    if (conversationIds.length === 0) {
      return [];
    }

    return this.db
      .selectFrom("argus_dm_participants")
      .innerJoin("argus_users", "argus_users.id", "argus_dm_participants.argus_user_id")
      .select([
        "argus_dm_participants.argus_user_id",
        "argus_users.username",
        "argus_users.role",
        "argus_dm_participants.invited_by_argus_user_id",
        "argus_dm_participants.joined_at_ms",
        "argus_dm_participants.last_read_at_ms",
        "argus_dm_participants.conversation_id",
      ])
      .where("argus_dm_participants.conversation_id", "in", conversationIds)
      .where("argus_dm_participants.left_at_ms", "is", null)
      .orderBy("argus_users.username", "asc")
      .execute();
  }

  async listLatestMessages(conversationIds: string[]): Promise<Selectable<ArgusDmMessages>[]> {
    if (conversationIds.length === 0) {
      return [];
    }

    return this.db
      .selectFrom("argus_dm_messages")
      .distinctOn("conversation_id")
      .selectAll()
      .where("conversation_id", "in", conversationIds)
      .orderBy("conversation_id", "asc")
      .orderBy("created_at_ms", "desc")
      .execute();
  }

  async createConversation(
    input: CreateArgusDmConversationBody,
    ownerArgusUserId: string,
    participantArgusUserIds: string[],
  ): Promise<Selectable<ArgusDmConversations>> {
    return this.db.transaction().execute(async (trx) => {
      const conversation = await trx
        .insertInto("argus_dm_conversations")
        .values({
          title: input.title,
          owner_argus_user_id: ownerArgusUserId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const message = input.body
        ? await trx
            .insertInto("argus_dm_messages")
            .values({
              conversation_id: conversation.id,
              author_argus_user_id: ownerArgusUserId,
              body: input.body,
            })
            .returningAll()
            .executeTakeFirstOrThrow()
        : null;

      await trx
        .insertInto("argus_dm_participants")
        .values(
          participantArgusUserIds.map((argusUserId) => ({
            conversation_id: conversation.id,
            argus_user_id: argusUserId,
            invited_by_argus_user_id: argusUserId === ownerArgusUserId ? null : ownerArgusUserId,
            last_read_at_ms:
              argusUserId === ownerArgusUserId
                ? (message?.created_at_ms ?? sql`get_unix_ms()`)
                : null,
          })),
        )
        .execute();

      return conversation;
    });
  }

  async updateConversation(
    conversationId: string,
    input: UpdateArgusDmConversationBody,
    invitedByArgusUserId: string,
  ): Promise<Selectable<ArgusDmConversations> | null> {
    return this.db.transaction().execute(async (trx) => {
      if (input.addRecipientArgusUserIds && input.addRecipientArgusUserIds.length > 0) {
        const latestMessage = await trx
          .selectFrom("argus_dm_messages")
          .select("created_at_ms")
          .where("conversation_id", "=", conversationId)
          .orderBy("created_at_ms", "desc")
          .executeTakeFirst();

        await trx
          .insertInto("argus_dm_participants")
          .values(
            input.addRecipientArgusUserIds.map((argusUserId) => ({
              conversation_id: conversationId,
              argus_user_id: argusUserId,
              invited_by_argus_user_id: invitedByArgusUserId,
              last_read_at_ms: latestMessage?.created_at_ms ?? sql`get_unix_ms()`,
              left_at_ms: null,
            })),
          )
          .onConflict((oc) =>
            oc.columns(["conversation_id", "argus_user_id"]).doUpdateSet({
              invited_by_argus_user_id: invitedByArgusUserId,
              last_read_at_ms: latestMessage?.created_at_ms ?? sql`get_unix_ms()`,
              left_at_ms: null,
              joined_at_ms: sql`get_unix_ms()`,
            }),
          )
          .execute();
      }

      return (
        (await trx
          .updateTable("argus_dm_conversations")
          .set({
            title: input.title,
            updated_at_ms: sql`get_unix_ms()`,
          })
          .where("id", "=", conversationId)
          .returningAll()
          .executeTakeFirst()) ?? null
      );
    });
  }

  async leaveConversation(conversationId: string, argusUserId: string): Promise<boolean> {
    return this.db.transaction().execute(async (trx) => {
      const participantResult = await trx
        .updateTable("argus_dm_participants")
        .set({ left_at_ms: sql`get_unix_ms()` })
        .where("conversation_id", "=", conversationId)
        .where("argus_user_id", "=", argusUserId)
        .where("left_at_ms", "is", null)
        .executeTakeFirst();

      if (participantResult.numUpdatedRows === 0n) {
        return false;
      }

      await trx
        .updateTable("argus_dm_conversations")
        .set({
          owner_argus_user_id: null,
          updated_at_ms: sql`get_unix_ms()`,
        })
        .where("id", "=", conversationId)
        .where("owner_argus_user_id", "=", argusUserId)
        .executeTakeFirst();

      return true;
    });
  }

  async listMessages(conversationId: string): Promise<Selectable<ArgusDmMessages>[]> {
    return this.db
      .selectFrom("argus_dm_messages")
      .selectAll()
      .where("conversation_id", "=", conversationId)
      .orderBy("created_at_ms", "asc")
      .execute();
  }

  async findMessageById(
    conversationId: string,
    messageId: string,
  ): Promise<Selectable<ArgusDmMessages> | null> {
    return (
      (await this.db
        .selectFrom("argus_dm_messages")
        .selectAll()
        .where("conversation_id", "=", conversationId)
        .where("id", "=", messageId)
        .executeTakeFirst()) ?? null
    );
  }

  async createMessage(
    conversationId: string,
    authorArgusUserId: string,
    body: string,
  ): Promise<Selectable<ArgusDmMessages>> {
    return this.db.transaction().execute(async (trx) => {
      const message = await trx
        .insertInto("argus_dm_messages")
        .values({
          conversation_id: conversationId,
          author_argus_user_id: authorArgusUserId,
          body,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await trx
        .updateTable("argus_dm_conversations")
        .set({ updated_at_ms: message.created_at_ms })
        .where("id", "=", conversationId)
        .executeTakeFirst();

      await trx
        .updateTable("argus_dm_participants")
        .set({ last_read_at_ms: message.created_at_ms })
        .where("conversation_id", "=", conversationId)
        .where("argus_user_id", "=", authorArgusUserId)
        .where("left_at_ms", "is", null)
        .executeTakeFirst();

      return message;
    });
  }

  async updateMessage(
    conversationId: string,
    messageId: string,
    body: string,
  ): Promise<Selectable<ArgusDmMessages> | null> {
    return (
      (await this.db
        .updateTable("argus_dm_messages")
        .set({
          body,
          edited_at_ms: sql`get_unix_ms()`,
        })
        .where("conversation_id", "=", conversationId)
        .where("id", "=", messageId)
        .where("deleted_at_ms", "is", null)
        .returningAll()
        .executeTakeFirst()) ?? null
    );
  }

  async deleteMessage(
    conversationId: string,
    messageId: string,
    deletedByArgusUserId: string,
  ): Promise<Selectable<ArgusDmMessages> | null> {
    return (
      (await this.db
        .updateTable("argus_dm_messages")
        .set({
          body: "[deleted]",
          edited_at_ms: null,
          deleted_at_ms: sql`get_unix_ms()`,
          deleted_by_argus_user_id: deletedByArgusUserId,
        })
        .where("conversation_id", "=", conversationId)
        .where("id", "=", messageId)
        .where("deleted_at_ms", "is", null)
        .returningAll()
        .executeTakeFirst()) ?? null
    );
  }

  async markConversationRead(conversationId: string, argusUserId: string): Promise<boolean> {
    const result = await this.db
      .updateTable("argus_dm_participants")
      .set({ last_read_at_ms: sql`get_unix_ms()` })
      .where("conversation_id", "=", conversationId)
      .where("argus_user_id", "=", argusUserId)
      .where("left_at_ms", "is", null)
      .executeTakeFirst();

    return result.numUpdatedRows > 0n;
  }

  async countUnreadConversations(argusUserId: string): Promise<number> {
    const row = await this.db
      .selectFrom("argus_dm_participants")
      .select((eb) => eb.fn.countAll<string>().as("total"))
      .where("argus_dm_participants.argus_user_id", "=", argusUserId)
      .where("argus_dm_participants.left_at_ms", "is", null)
      .where((eb) =>
        eb.exists(
          eb
            .selectFrom("argus_dm_messages")
            .select("argus_dm_messages.id")
            .whereRef(
              "argus_dm_messages.conversation_id",
              "=",
              "argus_dm_participants.conversation_id",
            )
            .where("argus_dm_messages.author_argus_user_id", "!=", argusUserId)
            .where("argus_dm_messages.deleted_at_ms", "is", null)
            .where((messageEb) =>
              messageEb.or([
                messageEb("argus_dm_participants.last_read_at_ms", "is", null),
                messageEb(
                  "argus_dm_messages.created_at_ms",
                  ">",
                  messageEb.ref("argus_dm_participants.last_read_at_ms"),
                ),
              ]),
            ),
        ),
      )
      .executeTakeFirstOrThrow();

    return Number(row.total);
  }

  async countUnreadMessages(
    conversationIds: string[],
    argusUserId: string,
  ): Promise<{ conversation_id: string; total: string | number | bigint }[]> {
    if (conversationIds.length === 0) {
      return [];
    }

    return this.db
      .selectFrom("argus_dm_participants")
      .innerJoin(
        "argus_dm_messages",
        "argus_dm_messages.conversation_id",
        "argus_dm_participants.conversation_id",
      )
      .select(["argus_dm_participants.conversation_id"])
      .select((eb) => eb.fn.count("argus_dm_messages.id").as("total"))
      .where("argus_dm_participants.conversation_id", "in", conversationIds)
      .where("argus_dm_participants.argus_user_id", "=", argusUserId)
      .where("argus_dm_participants.left_at_ms", "is", null)
      .where("argus_dm_messages.author_argus_user_id", "!=", argusUserId)
      .where("argus_dm_messages.deleted_at_ms", "is", null)
      .where((eb) =>
        eb.or([
          eb("argus_dm_participants.last_read_at_ms", "is", null),
          eb(
            "argus_dm_messages.created_at_ms",
            ">",
            eb.ref("argus_dm_participants.last_read_at_ms"),
          ),
        ]),
      )
      .groupBy("argus_dm_participants.conversation_id")
      .execute();
  }

  async listExistingActiveUserIds(argusUserIds: string[]): Promise<string[]> {
    if (argusUserIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .selectFrom("argus_users")
      .select("id")
      .where("id", "in", argusUserIds)
      .where("account_state", "=", "active")
      .execute();

    return rows.map((row) => row.id);
  }

  async findArgusUserById(argusUserId: string): Promise<Selectable<ArgusUsers> | null> {
    return (
      (await this.db
        .selectFrom("argus_users")
        .selectAll()
        .where("id", "=", argusUserId)
        .executeTakeFirst()) ?? null
    );
  }
}

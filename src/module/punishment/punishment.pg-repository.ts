import { type Kysely, sql, type Selectable } from "kysely";

import type { DB, Punishments } from "../../db/types.js";
import type { PaginatedResult } from "../../shared/pagination.schemas.js";
import type { CreatePunishmentBody, ListPunishmentsQuery } from "./punishment.schemas.js";

export type CreatePunishmentInput = CreatePunishmentBody & {
  subjectActorId: string;
  issuerActorId: string;
};

export type RevokePunishmentInput = {
  punishmentId: string;
  revokedByActorId: string;
  reason: string | null;
};

export class PunishmentPgRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async listPunishments(
    query: ListPunishmentsQuery,
  ): Promise<PaginatedResult<Selectable<Punishments>>> {
    const rowsQuery = this.db
      .selectFrom("punishments")
      .$if(query.subjectActorId !== undefined, (qb) =>
        qb.where("punishments.subject_actor_id", "=", query.subjectActorId ?? ""),
      )
      .$if(query.subjectPlayerId !== undefined, (qb) =>
        qb.where((eb) =>
          eb(
            "punishments.subject_actor_id",
            "in",
            eb
              .selectFrom("actors")
              .select("id")
              .where("actors.player_id", "=", query.subjectPlayerId ?? ""),
          ),
        ),
      )
      .$if(query.issuerActorId !== undefined, (qb) =>
        qb.where("punishments.issuer_actor_id", "=", query.issuerActorId ?? ""),
      )
      .$if(query.serverOriginId !== undefined, (qb) =>
        qb.where("punishments.server_origin_id", "=", query.serverOriginId ?? ""),
      )
      .$if(query.type !== undefined, (qb) =>
        qb.where("punishments.type", "=", query.type ?? "warn"),
      )
      .$if(query.revoked !== undefined, (qb) =>
        query.revoked === true
          ? qb.where("punishments.revoked_at_ms", "is not", null)
          : qb.where("punishments.revoked_at_ms", "is", null),
      )
      .$if(query.active !== undefined, (qb) =>
        query.active === true
          ? qb
              .where("punishments.revoked_at_ms", "is", null)
              .where((eb) =>
                eb.or([
                  eb("punishments.type", "in", ["warn", "kick"]),
                  eb("punishments.ends_at_ms", "is", null),
                  eb("punishments.ends_at_ms", ">", sql<string>`get_unix_ms()`),
                ]),
              )
          : qb.where((eb) =>
              eb.or([
                eb("punishments.revoked_at_ms", "is not", null),
                eb("punishments.ends_at_ms", "<=", sql<string>`get_unix_ms()`),
              ]),
            ),
      );

    const [rows, countRow] = await Promise.all([
      rowsQuery
        .selectAll("punishments")
        .orderBy("created_at_ms", "desc")
        .limit(query.limit)
        .offset(query.offset)
        .execute(),
      rowsQuery
        .clearSelect()
        .select((eb) => eb.fn.countAll<string>().as("total"))
        .executeTakeFirstOrThrow(),
    ]);

    return {
      rows,
      total: Number(countRow.total),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async findPunishmentById(id: string): Promise<Selectable<Punishments> | null> {
    return (
      (await this.db
        .selectFrom("punishments")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst()) ?? null
    );
  }

  async findActorIdByPlayerId(playerId: string): Promise<string | null> {
    const row = await this.db
      .selectFrom("actors")
      .select("id")
      .where("player_id", "=", playerId)
      .executeTakeFirst();

    return row?.id ?? null;
  }

  async createPunishment(input: CreatePunishmentInput): Promise<Selectable<Punishments>> {
    return this.db
      .insertInto("punishments")
      .values({
        subject_actor_id: input.subjectActorId,
        issuer_actor_id: input.issuerActorId,
        server_origin_id: input.serverOriginId ?? null,
        type: input.type,
        reason: input.reason ?? null,
        is_silent: input.isSilent,
        ends_at_ms: input.endsAtMs ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async revokePunishment(input: RevokePunishmentInput): Promise<Selectable<Punishments> | null> {
    return (
      (await this.db
        .updateTable("punishments")
        .set({
          revoked_by_actor_id: input.revokedByActorId,
          revoked_at_ms: sql`get_unix_ms()`,
          revocation_reason: input.reason,
          updated_at_ms: sql`get_unix_ms()`,
        })
        .where("id", "=", input.punishmentId)
        .where("revoked_at_ms", "is", null)
        .returningAll()
        .executeTakeFirst()) ?? null
    );
  }

  async punishmentExists(id: string): Promise<boolean> {
    const row = await this.db
      .selectFrom("punishments")
      .select("id")
      .where("id", "=", id)
      .executeTakeFirst();

    return Boolean(row);
  }
}

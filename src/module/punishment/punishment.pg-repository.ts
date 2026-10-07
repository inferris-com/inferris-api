import { type Kysely, sql, type Selectable } from "kysely";

import type { DB, Punishment, Punishments } from "@/db/types.js";
import type { PaginatedResult } from "@/shared/pagination.schemas.js";
import { loadActorSummaries } from "@/module/actor/actor-summary.js";
import type { ActorSummaryResponse } from "@/module/actor/actor.response.types.js";
import type {
  CreatePunishmentBody,
  ListPunishmentsQuery,
} from "@/module/punishment/punishment.schemas.js";

export type CreatePunishmentInput = CreatePunishmentBody & {
  code: string;
  subjectActorId: string;
  issuerActorId: string;
};

export type RevokePunishmentInput = {
  punishmentId: string;
  liftedByActorId: string;
  reason: string | null;
};

export type PunishmentListRow = Selectable<Punishments> & {
  subjectActor?: ActorSummaryResponse | null;
  issuerActor?: ActorSummaryResponse | null;
};

export class PunishmentPgRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async listPunishments(query: ListPunishmentsQuery): Promise<PaginatedResult<PunishmentListRow>> {
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
              .selectFrom("players")
              .select("actor_id")
              .where("players.id", "=", query.subjectPlayerId ?? ""),
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
          ? qb.where("punishments.lifted_cause", "=", "revoked")
          : qb.where((eb) =>
              eb.or([
                eb("punishments.lifted_cause", "is", null),
                eb("punishments.lifted_cause", "!=", "revoked"),
              ]),
            ),
      )
      .$if(query.active !== undefined, (qb) =>
        query.active === true
          ? qb
              .where("punishments.is_active", "=", true)
              .where("punishments.type", "in", ["ban", "mute"])
              .where("punishments.lifted_cause", "is", null)
              .where((eb) =>
                eb.or([
                  eb("punishments.ends_at_ms", "is", null),
                  eb("punishments.ends_at_ms", ">", sql<string>`get_unix_ms()`),
                ]),
              )
          : qb.where((eb) =>
              eb.or([
                eb("punishments.is_active", "=", false),
                eb("punishments.type", "not in", ["ban", "mute"]),
                eb("punishments.lifted_cause", "is not", null),
                eb.and([
                  eb("punishments.ends_at_ms", "is not", null),
                  eb("punishments.ends_at_ms", "<=", sql<string>`get_unix_ms()`),
                ]),
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

    const identities =
      query.include === "identities"
        ? await loadActorSummaries(
            this.db,
            rows.flatMap((row) => [row.subject_actor_id, row.issuer_actor_id]),
          )
        : null;

    return {
      rows: identities
        ? rows.map((row) => ({
            ...row,
            subjectActor: identities.get(row.subject_actor_id) ?? null,
            issuerActor: identities.get(row.issuer_actor_id) ?? null,
          }))
        : rows,
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

  async findPunishmentByCode(code: string): Promise<Selectable<Punishments> | null> {
    return (
      (await this.db
        .selectFrom("punishments")
        .selectAll()
        .where("code", "=", code)
        .executeTakeFirst()) ?? null
    );
  }

  async findSubjectActorId(
    input: Pick<CreatePunishmentBody, "subjectPlayerId" | "subjectActorId">,
  ): Promise<string | null> {
    const subjectId = input.subjectPlayerId ?? input.subjectActorId;
    if (!subjectId) return null;

    const row = await this.db
      .selectFrom("players")
      .innerJoin("actors", "actors.id", "players.actor_id")
      .select("players.actor_id")
      .where("actors.type", "=", "user")
      .where(input.subjectPlayerId ? "players.id" : "actors.id", "=", subjectId)
      .executeTakeFirst();

    return row?.actor_id ?? null;
  }

  async createPunishment(input: CreatePunishmentInput): Promise<Selectable<Punishments>> {
    return this.db
      .insertInto("punishments")
      .values({
        code: input.code,
        subject_actor_id: input.subjectActorId,
        issuer_actor_id: input.issuerActorId,
        server_origin_id: input.serverOriginId ?? null,
        type: input.type,
        reason: input.reason ?? null,
        note: input.note ?? null,
        is_silent: input.isSilent,
        is_active: isActivePunishmentType(input.type),
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
          is_active: false,
          lifted_cause: "revoked",
          lifted_by_actor_id: input.liftedByActorId,
          lifted_at_ms: sql`get_unix_ms()`,
          lift_note: input.reason,
          updated_at_ms: sql`get_unix_ms()`,
        })
        .where("id", "=", input.punishmentId)
        .where("is_active", "=", true)
        .returningAll()
        .executeTakeFirst()) ?? null
    );
  }

  async expirePunishments(
    subjectActorId?: string,
    type?: Punishment,
    punishmentId?: string,
  ): Promise<Selectable<Punishments>[]> {
    return this.db
      .updateTable("punishments")
      .set({
        is_active: false,
        lifted_cause: "expired",
        lifted_at_ms: sql`get_unix_ms()`,
        updated_at_ms: sql`get_unix_ms()`,
      })
      .$if(punishmentId !== undefined, (qb) => qb.where("id", "=", punishmentId ?? ""))
      .$if(subjectActorId !== undefined, (qb) =>
        qb.where("subject_actor_id", "=", subjectActorId ?? ""),
      )
      .$if(type !== undefined, (qb) => qb.where("type", "=", type ?? "ban"))
      .where("is_active", "=", true)
      .where("type", "in", ["ban", "mute"])
      .where("ends_at_ms", "is not", null)
      .where("ends_at_ms", "<=", sql<string>`get_unix_ms()`)
      .returningAll()
      .execute();
  }

  async findActivePunishment(
    subjectActorId: string,
    type: "ban" | "mute",
  ): Promise<Selectable<Punishments> | null> {
    return (
      (await this.db
        .selectFrom("punishments")
        .selectAll()
        .where("subject_actor_id", "=", subjectActorId)
        .where("type", "=", type)
        .where("is_active", "=", true)
        .where("lifted_cause", "is", null)
        .where((eb) =>
          eb.or([eb("ends_at_ms", "is", null), eb("ends_at_ms", ">", sql<string>`get_unix_ms()`)]),
        )
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

function isActivePunishmentType(type: Punishment): boolean {
  return type === "ban" || type === "mute";
}

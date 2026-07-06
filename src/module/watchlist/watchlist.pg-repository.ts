import { type Kysely, sql } from "kysely";

import type { DB } from "../../db/types.js";
import type { PaginatedResult } from "../../shared/pagination.schemas.js";
import type { WatchlistEntryRecord } from "./watchlist.mapper.js";
import type {
  AddWatchlistBody,
  ClearWatchlistBody,
  GetActiveWatchlistQuery,
  ListWatchlistQuery,
} from "./watchlist.schemas.js";

export type AddWatchlistInput = AddWatchlistBody & {
  subjectActorId: string;
  addedByActorId: string;
};

export type ClearWatchlistInput = ClearWatchlistBody & {
  subjectActorId: string;
  clearedByActorId: string;
};

export class WatchlistPgRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async listEntries(query: ListWatchlistQuery): Promise<PaginatedResult<WatchlistEntryRecord>> {
    const subjectActorId =
      query.subjectActorId ?? (await this.findActorIdByPlayerId(query.subjectPlayerId));
    const rowsQuery = this.baseSelect()
      .$if(subjectActorId !== null, (qb) =>
        qb.where("actor_watchlist_entries.subject_actor_id", "=", subjectActorId ?? ""),
      )
      .$if(query.severity !== undefined, (qb) =>
        qb.where("actor_watchlist_entries.severity", "=", query.severity ?? "low"),
      )
      .$if(query.active !== undefined, (qb) =>
        query.active === true
          ? qb
              .where("actor_watchlist_entries.cleared_at_ms", "is", null)
              .where((eb) =>
                eb.or([
                  eb("actor_watchlist_entries.expires_at_ms", "is", null),
                  eb("actor_watchlist_entries.expires_at_ms", ">", sql<string>`get_unix_ms()`),
                ]),
              )
          : qb.where("actor_watchlist_entries.cleared_at_ms", "is not", null),
      );

    const [rows, countRow] = await Promise.all([
      rowsQuery
        .orderBy("actor_watchlist_entries.added_at_ms", "desc")
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

  async findActiveEntry(query: GetActiveWatchlistQuery): Promise<WatchlistEntryRecord | null> {
    const subjectActorId =
      query.subjectActorId ?? (await this.findActorIdByPlayerId(query.subjectPlayerId));

    if (!subjectActorId) {
      return null;
    }

    return this.findActiveEntryByActorId(subjectActorId);
  }

  async findActiveEntryByActorId(subjectActorId: string): Promise<WatchlistEntryRecord | null> {
    return (
      (await this.baseSelect()
        .where("actor_watchlist_entries.cleared_at_ms", "is", null)
        .where((eb) =>
          eb.or([
            eb("actor_watchlist_entries.expires_at_ms", "is", null),
            eb("actor_watchlist_entries.expires_at_ms", ">", sql<string>`get_unix_ms()`),
          ]),
        )
        .where("actor_watchlist_entries.subject_actor_id", "=", subjectActorId)
        .orderBy("actor_watchlist_entries.added_at_ms", "desc")
        .executeTakeFirst()) ?? null
    );
  }

  async addEntry(input: AddWatchlistInput): Promise<WatchlistEntryRecord> {
    return this.db.transaction().execute(async (trx) => {
      await clearExpiredEntriesForActor(trx, input.subjectActorId);

      const existing = await trx
        .selectFrom("actor_watchlist_entries")
        .select("id")
        .where("subject_actor_id", "=", input.subjectActorId)
        .where("cleared_at_ms", "is", null)
        .executeTakeFirst();

      const values = {
        reason: input.reason ?? null,
        severity: input.severity ?? null,
        alert_on_join: input.alertOnJoin,
        alert_on_chat: input.alertOnChat,
        alert_note: input.alertNote ?? null,
        expires_at_ms: input.expiresAtMs ?? null,
        updated_at_ms: sql<string>`get_unix_ms()`,
      };

      const row = existing
        ? await trx
            .updateTable("actor_watchlist_entries")
            .set(values)
            .where("id", "=", existing.id)
            .returning("id")
            .executeTakeFirstOrThrow()
        : await trx
            .insertInto("actor_watchlist_entries")
            .values({
              subject_actor_id: input.subjectActorId,
              added_by_actor_id: input.addedByActorId,
              reason: input.reason ?? null,
              severity: input.severity ?? null,
              alert_on_join: input.alertOnJoin,
              alert_on_chat: input.alertOnChat,
              alert_note: input.alertNote ?? null,
              expires_at_ms: input.expiresAtMs ?? null,
            })
            .returning("id")
            .executeTakeFirstOrThrow();

      await setWatchlistedFlag(trx, input.subjectActorId, true);
      return loadEntryById(trx, row.id);
    });
  }

  async clearEntry(input: ClearWatchlistInput): Promise<WatchlistEntryRecord | null> {
    return this.db.transaction().execute(async (trx) => {
      const row = await trx
        .updateTable("actor_watchlist_entries")
        .set({
          cleared_by_actor_id: input.clearedByActorId,
          cleared_at_ms: sql`get_unix_ms()`,
          updated_at_ms: sql`get_unix_ms()`,
        })
        .where("subject_actor_id", "=", input.subjectActorId)
        .where("cleared_at_ms", "is", null)
        .returning("id")
        .executeTakeFirst();

      await setWatchlistedFlag(trx, input.subjectActorId, false);
      return row ? loadEntryById(trx, row.id) : null;
    });
  }

  async actorExists(actorId: string): Promise<boolean> {
    const row = await this.db
      .selectFrom("actors")
      .select("id")
      .where("id", "=", actorId)
      .executeTakeFirst();

    return Boolean(row);
  }

  async findActorIdByPlayerId(playerId: string | undefined): Promise<string | null> {
    if (!playerId) {
      return null;
    }

    const row = await this.db
      .selectFrom("players")
      .select("actor_id")
      .where("id", "=", playerId)
      .executeTakeFirst();

    return row?.actor_id ?? null;
  }

  private baseSelect() {
    return this.db
      .selectFrom("actor_watchlist_entries")
      .innerJoin("actors", "actors.id", "actor_watchlist_entries.subject_actor_id")
      .leftJoin("players", "players.actor_id", "actors.id")
      .select([
        "actor_watchlist_entries.id",
        "actor_watchlist_entries.subject_actor_id",
        "players.id as subject_player_id",
        "players.username as subject_username",
        "actor_watchlist_entries.added_by_actor_id",
        "actor_watchlist_entries.reason",
        "actor_watchlist_entries.severity",
        "actor_watchlist_entries.alert_on_join",
        "actor_watchlist_entries.alert_on_chat",
        "actor_watchlist_entries.alert_note",
        "actor_watchlist_entries.expires_at_ms",
        "actor_watchlist_entries.cleared_by_actor_id",
        "actor_watchlist_entries.cleared_at_ms",
        "actor_watchlist_entries.added_at_ms",
        "actor_watchlist_entries.updated_at_ms",
      ]);
  }
}

async function loadEntryById(
  db: Kysely<DB>,
  id: number,
): Promise<WatchlistEntryRecord> {
  return db
    .selectFrom("actor_watchlist_entries")
    .innerJoin("actors", "actors.id", "actor_watchlist_entries.subject_actor_id")
    .leftJoin("players", "players.actor_id", "actors.id")
    .select([
      "actor_watchlist_entries.id",
      "actor_watchlist_entries.subject_actor_id",
      "players.id as subject_player_id",
      "players.username as subject_username",
      "actor_watchlist_entries.added_by_actor_id",
      "actor_watchlist_entries.reason",
      "actor_watchlist_entries.severity",
      "actor_watchlist_entries.alert_on_join",
      "actor_watchlist_entries.alert_on_chat",
      "actor_watchlist_entries.alert_note",
      "actor_watchlist_entries.expires_at_ms",
      "actor_watchlist_entries.cleared_by_actor_id",
      "actor_watchlist_entries.cleared_at_ms",
      "actor_watchlist_entries.added_at_ms",
      "actor_watchlist_entries.updated_at_ms",
    ])
    .where("actor_watchlist_entries.id", "=", id)
    .executeTakeFirstOrThrow();
}

async function clearExpiredEntriesForActor(db: Kysely<DB>, subjectActorId: string): Promise<void> {
  await db
    .updateTable("actor_watchlist_entries")
    .set({
      cleared_at_ms: sql`get_unix_ms()`,
      updated_at_ms: sql`get_unix_ms()`,
    })
    .where("subject_actor_id", "=", subjectActorId)
    .where("cleared_at_ms", "is", null)
    .where("expires_at_ms", "is not", null)
    .where("expires_at_ms", "<=", sql<string>`get_unix_ms()`)
    .execute();
}

async function setWatchlistedFlag(
  db: Kysely<DB>,
  subjectActorId: string,
  enabled: boolean,
): Promise<void> {
  const flag = await db
    .selectFrom("player_flag_definitions")
    .select("bit_position")
    .where("flag_key", "=", "WATCHLISTED")
    .executeTakeFirst();

  if (!flag) {
    return;
  }

  const bit = 1n << BigInt(flag.bit_position);
  await db
    .updateTable("players")
    .set({
      flags: enabled
        ? sql`(players.flags | ${bit.toString()}::bigint)`
        : sql`(players.flags & ~${bit.toString()}::bigint)`,
    })
    .where((eb) =>
      eb("players.actor_id", "=", subjectActorId),
    )
    .execute();
}

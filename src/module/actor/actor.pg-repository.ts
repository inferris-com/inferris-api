import { type Kysely, type Selectable, sql } from "kysely";
import type { Actors, DB } from "@/db/types.js";
import type {
  ListActorsQuery,
  SearchActorsQuery,
  UpdateActorBody,
} from "@/module/actor/actor.schemas.js";
import type { PaginatedResult } from "@/shared/pagination.schemas.js";

export class ActorPgRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async listActors({
    limit,
    offset,
    name,
    type,
  }: ListActorsQuery): Promise<PaginatedResult<Selectable<Actors>> | null> {
    return await this.db.transaction().execute(async (trx) => {
      const actors = await trx
        .selectFrom("actors")
        .leftJoin("players", "players.actor_id", "actors.id")
        .selectAll("actors")
        .select("players.id as player_id")
        .$if(name !== undefined, (qb) => qb.where("actors.name", "=", name ?? ""))
        .$if(type !== undefined, (qb) => qb.where("actors.type", "=", type ?? "unspecified"))
        .limit(limit)
        .offset(offset)
        .orderBy("actors.created_at_ms", "asc")
        .execute();

      if (actors.length === 0) {
        return null;
      }

      return {
        rows: actors,
        total: actors.length,
        limit: limit,
        offset: offset,
      };
    });
  }

  async searchActors({ q, limit }: SearchActorsQuery) {
    const pattern = `%${q}%`;
    const prefixPattern = `${q}%`;

    return this.db
      .selectFrom("actors")
      .leftJoin("players", "players.actor_id", "actors.id")
      .selectAll("actors")
      .select("players.id as player_id")
      .where("actors.name", "ilike", pattern)
      .orderBy(
        sql<number>`case
          when lower(actors.name) = lower(${q}) then 0
          when actors.name ilike ${prefixPattern} then 1
          else 2
        end`,
        "asc",
      )
      .orderBy("actors.name", "asc")
      .orderBy("actors.id", "asc")
      .limit(limit)
      .execute();
  }

  async findActorById(id: string) {
    return await this.db.transaction().execute(async (trx) => {
      return await trx
        .selectFrom("actors")
        .leftJoin("players", "players.actor_id", "actors.id")
        .selectAll("actors")
        .select("players.id as player_id")
        .where("actors.id", "=", id)
        .executeTakeFirst();
    });
  }

  async findActorByPlayerId(id: string) {
    return await this.db.transaction().execute(async (trx) => {
      const actor = await trx
        .selectFrom("players")
        .innerJoin("actors", "actors.id", "players.actor_id")
        .selectAll("actors")
        .select("players.id as player_id")
        .where("players.id", "=", id)
        .executeTakeFirst();

      if (!actor) return null;

      return actor;
    });
  }

  async updateActorById(id: string, input: UpdateActorBody) {
    return this.db.transaction().execute(async (trx) => {
      const actor = await trx
        .updateTable("actors")
        .set({ name: input.name, last_updated_at_ms: sql`get_unix_ms()` })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst();
      if (!actor) return null;

      const player = await trx
        .selectFrom("players")
        .select("id")
        .where("actor_id", "=", id)
        .executeTakeFirst();
      return { ...actor, player_id: player?.id ?? null };
    });
  }
}

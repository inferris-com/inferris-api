import { type Kysely, type Selectable, sql } from "kysely";
import type { Actors, ActorType, DB } from "../../db/types.js";
import type { ListActorsQuery, SearchActorsQuery, UpdateActorBody } from "./actor.schemas.js";
import type { DeleteResult } from "../../shared/results.types.js";
import { isForeignKeyViolation } from "../../shared/db/pg-error.utils.js";
import type { PaginatedResult } from "../../shared/pagination.schemas.js";

export class ActorPgRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async listActors({ limit, offset, name, type }: ListActorsQuery): Promise<PaginatedResult<Selectable<Actors>> | null> {
    return await this.db.transaction().execute(async (trx) => {
      const actors = await trx
        .selectFrom("actors")
        .selectAll()
        .$if(name !== undefined, (qb) => qb.where("actors.name", "=", name ?? ""))
        .$if(type !== undefined, (qb) => qb.where("actors.type", "=", type ?? "unspecified"))
        .limit(limit)
        .offset(offset)
        .orderBy("actors.created_at_ms", "asc")
        .execute();

      if (actors.length === 0){
        return null;
      }

      return {
        rows: actors,
        total: actors.length,
        limit: limit,
        offset: offset
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
      const actor = await trx
        .selectFrom("actors")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();

      if (!actor) return null;

      return actor;
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

  // todo check if exists
  async updateActorById(id: string, input: UpdateActorBody): Promise<Selectable<Actors> | null> {
    return await this.db.transaction().execute(async (trx) => {
      const actorUpdate: {
        name?: string;
        type?: ActorType;
        created_at_ms?: string;
        last_updated_at_ms?: string;
      } = {};

      if (input.name != undefined) {
        actorUpdate.name = input.name;
      }
      if (input.type != undefined) {
        actorUpdate.type = input.type;
      }
      if (input.createdAtMs != undefined) {
        actorUpdate.created_at_ms = input.createdAtMs;
      }
      if (input.lastUpdatedAtMs != undefined) {
        actorUpdate.last_updated_at_ms = input.lastUpdatedAtMs;
      }

      if (Object.keys(actorUpdate).length === 0) {
        return null;
      }

      const actor = await trx
        .updateTable("actors")
        .set(actorUpdate)
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst();

      if (actor && input.playerId != undefined) {
        await trx
          .updateTable("players")
          .set({ actor_id: actor.id })
          .where("id", "=", input.playerId)
          .executeTakeFirst();
      }

      return actor ?? null;
    });
  }

  // Dangerous
  async deleteActorById(id: string): Promise<DeleteResult> {
    return await this.db.transaction().execute(async (trx) => {
      try {
        const result = await trx.deleteFrom("actors").where("id", "=", id).executeTakeFirst();

        if (result.numDeletedRows === 0n) {
          return { status: "not_found" };
        }
      } catch (err) {
        if (isForeignKeyViolation(err))
          return { status: "conflict", cause: "referenced_by_other_rows" } as const;
      }
      return { status: "deleted" };
    });
  }
}

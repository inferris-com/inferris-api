import type { Kysely, Selectable } from "kysely";
import type { Actors, ActorType, DB } from "../../db/types.js";
import type { UpdateActorBody } from "./actor.schemas.js";
import type { DeleteResult } from "../../shared/results.types.js";
import { isForeignKeyViolation } from "../../shared/db/pg-error.utils.js";

export class ActorPgRepository {
  constructor(private readonly db: Kysely<DB>) {}

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
        .selectFrom("actors")
        .selectAll()
        .where("player_id", "=", id)
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
        player_id?: string;
        created_at_ms?: string;
        last_updated_at_ms?: string;
      } = {};

      if (input.name != undefined) {
        actorUpdate.name = input.name;
      }
      if (input.type != undefined) {
        actorUpdate.type = input.type;
      }
      if (input.playerId != undefined) {
        actorUpdate.player_id = input.playerId;
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

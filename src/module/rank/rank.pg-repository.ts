import { sql, type Kysely } from "kysely";

import type { DB } from "@/db/types.js";
import { toRankInsert, toRankUpdate } from "@/module/rank/rank.mapper.js";
import type { CreateRankBody, ListRanksQuery, UpdateRankBody } from "@/module/rank/rank.schemas.js";

export class RankPgRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async listRanks(query: ListRanksQuery) {
    return this.db
      .selectFrom("ranks")
      .selectAll()
      .$if(query.groupKey !== undefined, (qb) => qb.where("group_key", "=", query.groupKey ?? ""))
      .$if(query.staffOnly === true, (qb) => qb.where("is_staff", "=", true))
      .$if(query.includeInactive !== true, (qb) => qb.where("is_active", "=", true))
      .orderBy("tier", "desc")
      .orderBy("label", "asc")
      .execute();
  }

  async findRankByKey(rankKey: string) {
    return this.db.selectFrom("ranks").selectAll().where("key", "=", rankKey).executeTakeFirst();
  }

  async createRank(input: CreateRankBody) {
    return this.db
      .insertInto("ranks")
      .values(toRankInsert(input))
      .onConflict((oc) => oc.doNothing())
      .returningAll()
      .executeTakeFirst();
  }

  async updateRank(rankKey: string, input: UpdateRankBody) {
    return this.db
      .updateTable("ranks")
      .set({ ...toRankUpdate(input), updated_at_ms: sql`get_unix_ms()` })
      .where("key", "=", rankKey)
      .returningAll()
      .executeTakeFirst();
  }

  async deleteRank(rankKey: string): Promise<boolean> {
    const result = await this.db.deleteFrom("ranks").where("key", "=", rankKey).executeTakeFirst();

    return result.numDeletedRows > 0n;
  }
}

import type { Kysely } from "kysely";

import type { DB } from "../../db/types.js";
import { toBadgeInsert, toBadgeUpdate } from "./badge.mapper.js";
import type { CreateBadgeBody, ListBadgesQuery, UpdateBadgeBody } from "./badge.schemas.js";

export class BadgePgRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async listBadges(query: ListBadgesQuery) {
    return this.db
      .selectFrom("badges")
      .selectAll()
      .$if(query.includeInactive !== true, (qb) => qb.where("is_active", "=", true))
      .orderBy("display_order", "asc")
      .orderBy("label", "asc")
      .execute();
  }

  async findBadgeById(badgeId: number) {
    return this.db.selectFrom("badges").selectAll().where("id", "=", badgeId).executeTakeFirst();
  }

  async createBadge(input: CreateBadgeBody) {
    return this.db
      .insertInto("badges")
      .values(toBadgeInsert(input))
      .onConflict((oc) => oc.doNothing())
      .returningAll()
      .executeTakeFirst();
  }

  async updateBadge(badgeId: number, input: UpdateBadgeBody) {
    return this.db
      .updateTable("badges")
      .set(toBadgeUpdate(input))
      .where("id", "=", badgeId)
      .returningAll()
      .executeTakeFirst();
  }

  async deleteBadge(badgeId: number): Promise<boolean> {
    const result = await this.db.deleteFrom("badges").where("id", "=", badgeId).executeTakeFirst();

    return result.numDeletedRows > 0n;
  }
}

import type { Kysely } from "kysely";

import type { DB } from "../../db/types.js";
import type { ListBadgesQuery, ListGroupsQuery, ListRanksQuery } from "./catalog.schemas.js";

export class CatalogPgRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async listGroups(query: ListGroupsQuery) {
    return this.db
      .selectFrom("groups")
      .selectAll()
      .$if(query.staffOnly === true, (qb) => qb.where("is_staff", "=", true))
      .orderBy("priority", "desc")
      .orderBy("label", "asc")
      .execute();
  }

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

  async listBadges(query: ListBadgesQuery) {
    return this.db
      .selectFrom("badges")
      .selectAll()
      .$if(query.includeInactive !== true, (qb) => qb.where("is_active", "=", true))
      .orderBy("display_order", "asc")
      .orderBy("label", "asc")
      .execute();
  }
}

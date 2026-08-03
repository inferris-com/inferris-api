import { sql, type Kysely } from "kysely";

import type { DB } from "@/db/types.js";
import { toGroupInsert, toGroupUpdate } from "@/module/group/group.mapper.js";
import type {
  CreateGroupBody,
  ListGroupsQuery,
  UpdateGroupBody,
} from "@/module/group/group.schemas.js";

export class GroupPgRepository {
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

  async findGroupByKey(groupKey: string) {
    return this.db.selectFrom("groups").selectAll().where("key", "=", groupKey).executeTakeFirst();
  }

  async createGroup(input: CreateGroupBody) {
    return this.db
      .insertInto("groups")
      .values(toGroupInsert(input))
      .onConflict((oc) => oc.doNothing())
      .returningAll()
      .executeTakeFirst();
  }

  async updateGroup(groupKey: string, input: UpdateGroupBody) {
    return this.db
      .updateTable("groups")
      .set({ ...toGroupUpdate(input), updated_at_ms: sql`get_unix_ms()` })
      .where("key", "=", groupKey)
      .returningAll()
      .executeTakeFirst();
  }

  async deleteGroup(groupKey: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom("groups")
      .where("key", "=", groupKey)
      .executeTakeFirst();

    return result.numDeletedRows > 0n;
  }
}

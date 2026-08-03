import { sql, type Kysely, type Selectable } from "kysely";

import type { ArgusUsers, DB } from "@/db/types.js";
import type { PaginatedResult } from "@/shared/pagination.schemas.js";
import {
  toArgusUserInsert,
  toArgusUserUpdate,
} from "@/module/argus/argus-user/argus-user.mapper.js";
import type {
  CreateArgusUserBody,
  ListArgusUsersQuery,
  UpdateArgusUserBody,
} from "@/module/argus/argus-user/argus-user.schemas.js";

export class ArgusUserPgRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async listUsers(query: ListArgusUsersQuery): Promise<PaginatedResult<Selectable<ArgusUsers>>> {
    const baseQuery = this.db
      .selectFrom("argus_users")
      .$if(query.role !== undefined, (qb) => qb.where("role", "=", query.role ?? "moderator"))
      .$if(query.accountState !== undefined, (qb) =>
        qb.where("account_state", "=", query.accountState ?? "active"),
      );

    const [rows, totalRow] = await Promise.all([
      baseQuery
        .selectAll()
        .orderBy("created_at_ms", "desc")
        .limit(query.limit)
        .offset(query.offset)
        .execute(),
      baseQuery.select((eb) => eb.fn.countAll<string>().as("total")).executeTakeFirstOrThrow(),
    ]);

    return { rows, total: Number(totalRow.total), limit: query.limit, offset: query.offset };
  }

  async findUserById(userId: string) {
    return this.db
      .selectFrom("argus_users")
      .selectAll()
      .where("id", "=", userId)
      .executeTakeFirst();
  }

  async resolveUsers(query: string, limit: number) {
    const pattern = `%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;

    return this.db
      .selectFrom("argus_users")
      .selectAll()
      .where("account_state", "=", "active")
      .where((eb) => eb.or([eb("username", "ilike", pattern), eb("email", "ilike", pattern)]))
      .orderBy("username", "asc")
      .limit(limit)
      .execute();
  }

  async createUser(input: CreateArgusUserBody, passwordHash: string | null) {
    return this.db
      .insertInto("argus_users")
      .values(toArgusUserInsert(input, passwordHash))
      .onConflict((oc) => oc.doNothing())
      .returningAll()
      .executeTakeFirst();
  }

  async updateUser(userId: string, input: UpdateArgusUserBody) {
    return this.db
      .updateTable("argus_users")
      .set({ ...toArgusUserUpdate(input), updated_at_ms: sql`get_unix_ms()` })
      .where("id", "=", userId)
      .returningAll()
      .executeTakeFirst();
  }

  async disableUser(userId: string) {
    return this.db
      .updateTable("argus_users")
      .set({ account_state: "disabled", updated_at_ms: sql`get_unix_ms()` })
      .where("id", "=", userId)
      .returningAll()
      .executeTakeFirst();
  }
}

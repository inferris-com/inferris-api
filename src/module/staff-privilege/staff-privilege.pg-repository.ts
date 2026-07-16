import { sql, type Kysely, type Selectable } from "kysely";

import type { DB, PrivilegedSubjects } from "../../db/types.js";
import type { PaginatedResult } from "../../shared/pagination.schemas.js";
import {
  toStaffPrivilegeInsert,
  toStaffPrivilegeUpdate,
} from "./staff-privilege.mapper.js";
import type {
  CreateStaffPrivilegeBody,
  ListStaffPrivilegesQuery,
  UpdateStaffPrivilegeBody,
} from "./staff-privilege.schemas.js";

export class StaffPrivilegePgRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async listPrivileges(
    query: ListStaffPrivilegesQuery,
  ): Promise<PaginatedResult<Selectable<PrivilegedSubjects>>> {
    const baseQuery = this.db
      .selectFrom("privileged_subjects")
      .$if(query.actorId !== undefined, (qb) => qb.where("actor_id", "=", query.actorId ?? ""))
      .$if(query.status !== undefined, (qb) => qb.where("status", "=", query.status ?? "active"))
      .$if(query.role !== undefined, (qb) => qb.where("role", "=", query.role ?? "none"));

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

  async findPrivilegeById(privilegeId: string) {
    return this.db
      .selectFrom("privileged_subjects")
      .selectAll()
      .where("id", "=", privilegeId)
      .executeTakeFirst();
  }

  async listPrivilegesByActorId(actorId: string) {
    return this.db
      .selectFrom("privileged_subjects")
      .selectAll()
      .where("actor_id", "=", actorId)
      .orderBy("created_at_ms", "desc")
      .execute();
  }

  async createPrivilege(input: CreateStaffPrivilegeBody, enrolledByActorId: string | null) {
    return this.db
      .insertInto("privileged_subjects")
      .values(toStaffPrivilegeInsert(input, enrolledByActorId))
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async updatePrivilege(privilegeId: string, input: UpdateStaffPrivilegeBody) {
    return this.db
      .updateTable("privileged_subjects")
      .set({ ...toStaffPrivilegeUpdate(input), updated_at_ms: sql`get_unix_ms()` })
      .where("id", "=", privilegeId)
      .returningAll()
      .executeTakeFirst();
  }

  async revokePrivilege(privilegeId: string, revokedByActorId: string | null) {
    return this.db
      .updateTable("privileged_subjects")
      .set({
        status: "revoked",
        revoked_by_actor_id: revokedByActorId,
        updated_at_ms: sql`get_unix_ms()`,
      })
      .where("id", "=", privilegeId)
      .returningAll()
      .executeTakeFirst();
  }
}

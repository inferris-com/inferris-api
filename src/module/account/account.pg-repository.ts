import { sql, type Kysely } from "kysely";

import type { DB } from "../../db/types.js";

export class AccountPgRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async findAccountById(id: string) {
    return this.db
      .selectFrom("argus_users")
      .leftJoin("actors", "actors.id", "argus_users.actor_id")
      .leftJoin("privileged_subjects", (join) =>
        join
          .onRef("privileged_subjects.actor_id", "=", "argus_users.actor_id")
          .on("privileged_subjects.status", "=", "active"),
      )
      .select([
        "argus_users.id",
        "argus_users.username",
        "argus_users.email",
        "argus_users.role",
        "argus_users.actor_id",
        "argus_users.account_state",
        "argus_users.created_at_ms",
        "argus_users.updated_at_ms",
        "actors.name as actor_name",
        "actors.type as actor_type",
        "privileged_subjects.id as privileged_id",
        "privileged_subjects.role as privileged_role",
        "privileged_subjects.title as privileged_title",
        "privileged_subjects.status as privileged_status",
      ])
      .where("argus_users.id", "=", id)
      .executeTakeFirst();
  }

  async findPasswordAuthById(id: string) {
    return this.db
      .selectFrom("argus_users")
      .select(["id", "password_hash"])
      .where("id", "=", id)
      .where("account_state", "=", "active")
      .executeTakeFirst();
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.db
      .updateTable("argus_users")
      .set({
        password_hash: passwordHash,
        updated_at_ms: sql`get_unix_ms()`,
      })
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
  }

  async listUnreadNotifications(accountId: string) {
    return this.db
      .selectFrom("argus_notifications")
      .selectAll()
      .where("account_id", "=", accountId)
      .where("read_at_ms", "is", null)
      .orderBy("priority", "desc")
      .orderBy("created_at_ms", "desc")
      .execute();
  }

  async markNotificationRead(accountId: string, notificationId: string): Promise<boolean> {
    const result = await this.db
      .updateTable("argus_notifications")
      .set({
        read_at_ms: sql`get_unix_ms()`,
      })
      .where("account_id", "=", accountId)
      .where("id", "=", notificationId)
      .where("read_at_ms", "is", null)
      .executeTakeFirst();

    return Number(result.numUpdatedRows) > 0;
  }
}

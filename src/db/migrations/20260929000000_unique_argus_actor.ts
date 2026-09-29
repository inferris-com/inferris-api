import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // Argus accounts and actors are separate identities, but one actor may back at most one login.
  await sql`ALTER TABLE argus_users ADD CONSTRAINT argus_users_actor_id_key UNIQUE (actor_id)`.execute(
    db,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE argus_users DROP CONSTRAINT argus_users_actor_id_key`.execute(db);
}

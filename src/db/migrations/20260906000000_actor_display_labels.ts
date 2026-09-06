import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // Actor names are display labels, not account identifiers or linking keys.
  await sql`ALTER TABLE actors DROP CONSTRAINT actors_name_key`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Rollback deliberately fails if duplicate labels have since been created.
  // Do not rename identities or discard records to force uniqueness.
  await sql`ALTER TABLE actors ADD CONSTRAINT actors_name_key UNIQUE (name)`.execute(db);
}

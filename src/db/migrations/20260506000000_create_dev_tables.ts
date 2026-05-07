import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("servers")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(db.fn("gen_random_uuid")))
    .addColumn("name", "varchar(100)", (col) => col.notNull().unique())
    .addColumn("type", "varchar(20)", (col) => col.notNull())
    .addColumn("version", "varchar(100)")
    .addColumn("player_count", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("last_heartbeat_ms", "bigint")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(db.fn("now")))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(db.fn("now")))
    .execute();

  await db.schema
    .createTable("players")
    .addColumn("id", "uuid", (col) => col.primaryKey())
    .addColumn("username", "varchar(17)", (col) => col.notNull().unique())
    .addColumn("flags", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("orbs", "integer", (col) => col.notNull().defaultTo(100))
    .addColumn("last_server_id", "uuid", (col) => col.references("servers.id").onDelete("set null"))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(db.fn("now")))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(db.fn("now")))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("players").ifExists().execute();
  await db.schema.dropTable("servers").ifExists().execute();
}

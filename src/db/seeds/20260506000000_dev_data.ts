import type { Kysely } from "kysely";
import type { Seed } from "kysely-ctl";

import type { DB } from "../types.js";

const seed = {
  async seed(db: Kysely<DB>) {
    await db
      .insertInto("servers")
      .values({
        name: "Local Paper",
        type: "paper",
        version: "dev",
        player_count: 0,
      })
      .onConflict((oc) =>
        oc.column("name").doUpdateSet({
          type: "paper",
          version: "dev",
          updated_at: new Date(),
        }),
      )
      .execute();

    const server = await db
      .selectFrom("servers")
      .select("id")
      .where("name", "=", "Local Paper")
      .executeTakeFirstOrThrow();

    await db
      .insertInto("players")
      .values({
        id: "00000000-0000-4000-8000-000000000001",
        username: "dev-player",
        flags: 0,
        orbs: 100,
        last_server_id: server.id,
      })
      .onConflict((oc) =>
        oc.column("id").doUpdateSet({
          username: "dev-player",
          last_server_id: server.id,
          updated_at: new Date(),
        }),
      )
      .execute();
  },
} satisfies Seed;

export default seed;

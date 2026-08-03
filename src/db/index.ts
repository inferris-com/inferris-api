import { Kysely, PostgresDialect, type Transaction } from "kysely";
import { Pool } from "pg";

import { config } from "@/config.js";
import type { DB } from "@/db/types.js";

export function createDb(databaseUrl = config.database.url) {
  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: databaseUrl,
        max: config.database.poolSize,
      }),
    }),
  });
}

export const db = createDb();
export type DbExecutor = Kysely<DB> | Transaction<DB>;

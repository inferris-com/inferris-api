import { defineConfig, getKnexTimestampPrefix } from "kysely-ctl";
import { Pool } from "pg";

import { config } from "@/config.js";

export default defineConfig({
  dialect: "pg",
  dialectConfig: {
    pool: new Pool({
      connectionString: config.database.url,
      max: config.database.poolSize,
    }),
  },
  migrations: {
    getMigrationPrefix: getKnexTimestampPrefix,
    migrationFolder: "src/db/migrations",
  },
  seeds: {
    getSeedPrefix: getKnexTimestampPrefix,
    seedFolder: "src/db/seeds",
  },
});

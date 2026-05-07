import { defineConfig } from "kysely-ctl";
import { Pool } from "pg";

import { config } from "./src/config.js";

export default defineConfig({
  dialect: "pg",
  dialectConfig: {
    pool: new Pool({
      connectionString: config.database.url,
      max: config.database.poolSize,
    }),
  },
  migrations: {
    migrationFolder: "src/db/migrations",
  },
  seeds: {
    seedFolder: "src/db/seeds",
  },
});

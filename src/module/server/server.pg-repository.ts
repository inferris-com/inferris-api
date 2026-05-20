import {sql, type Kysely, type Transaction} from "kysely";

import type {DB} from "../../db/types.js";
import type {ServerRepository} from "./server.repository.js";
import type {ServerResponse} from "./server.response.types.js";
import {toServerResponse} from "./server.mapper.js";

type DbExecutor = Kysely<DB> | Transaction<DB>;

export class PgServerRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async findServerById(id: string): Promise<ServerResponse | null> {
    return this.db.transaction().execute(async (trx) => {
      const server = await trx
        .selectFrom("servers")
        .select([
          "id",
          "name",
          "type",
          "environment",
          "status",
          "port",
          "version",
          "last_started_at_ms",
          "last_heartbeat_at_ms",
          "created_at_ms",
          "last_updated_at_ms",
        ])
        .where("id", "=", id)
        .executeTakeFirst();

      if (!server) {
        return null;
      }

      return toServerResponse(server);
    });
  }
}

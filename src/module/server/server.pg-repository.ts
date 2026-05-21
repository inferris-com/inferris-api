import type { Kysely } from "kysely";

import type { DB } from "../../db/types.js";
import type { CreateServerBody } from "./server.schemas.js";
import type { CreateResult } from "../../shared/results.types.js";

export class PgServerRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async createServer(input: CreateServerBody): Promise<CreateResult> {
    return await this.db.transaction().execute(async (trx) => {
      const server = await trx
        .insertInto("servers")
        .values({
          name: input.name,
          type: input.type,
          environment: input.environment,
          status: input.status,
          port: input.port,
          version: input.version,
        })
        .onConflict((oc) => oc.column("name").doNothing())
        .returningAll()
        .executeTakeFirst();

      if (!server) {
        return { status: "conflict" };
      }

      return {
        status: "created",
        object: server,
      };
    });
  }

  async findServerById(id: string) {
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

      return server;
    });
  }

  async findAccessPolicyByServerId(id: string) {
    return this.db.transaction().execute(async (trx) => {
      const server = await trx
        .selectFrom("server_access_policies")
        .selectAll()
        .where("server_id", "=", id)
        .executeTakeFirst();

      if (!server) {
        return null;
      }

      return server;
    });
  }

  async findLockdownByServerId(id: string) {
    return this.db.transaction().execute(async (trx) => {
      const server = await trx
        .selectFrom("lockdowns")
        .selectAll()
        .where("server_id", "=", id)
        .executeTakeFirst();

      if (!server) {
        return null;
      }

      return server;
    });
  }
}

import type { Kysely, Selectable } from "kysely";

import type {
  DB,
  Lockdowns,
  ServerAccessPolicies,
  ServerEnv,
  Servers,
  ServerStatus,
  ServerType,
} from "../../db/types.js";
import type {
  CreateLockdownInput,
  CreateServerBody,
  ReplaceServerAccessBody,
  UpdateServerBody,
} from "./server.schemas.js";
import type { CreateResult } from "../../shared/results.types.js";

export type CreateServerResult = CreateResult<Selectable<Servers>>;
export type CreateLockdownResult = CreateResult<Selectable<Lockdowns>>;
export type CreatePolicyResult =
  | CreateResult<Selectable<ServerAccessPolicies>>
  | { status: "not_found" };

export class ServerPgRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async createServer(input: CreateServerBody): Promise<CreateServerResult> {
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

      if (!server) return { status: "conflict" };

      return { status: "created", data: server };
    });
  }

  async createLockdown({
    serverId,
    scope,
    reason,
    issuedByActorId,
    requiredRankKey,
    isActive,
    startsAtMs,
    endsAtMs,
  }: CreateLockdownInput): Promise<CreateLockdownResult> {
    return await this.db.transaction().execute(async (trx) => {
      const lockdown = await trx
        .insertInto("lockdowns")
        .values({
          server_id: serverId,
          scope: scope,
          reason: reason,
          issued_by_actor_id: issuedByActorId,
          required_rank_key: requiredRankKey,
          is_active: isActive,
          starts_at_ms: startsAtMs,
          ends_at_ms: endsAtMs,
        })
        .returningAll()
        .executeTakeFirst();

      if (!lockdown) return { status: "conflict" };

      return { status: "created", data: lockdown };
    });
  }

  async createAccessPolicy(
    serverId: string,
    input: ReplaceServerAccessBody,
  ): Promise<CreatePolicyResult> {
    return await this.db.transaction().execute(async (trx) => {
      const server = await this.findServerById(serverId);

      if (!server) return { status: "not_found" };

      const policy = await trx
        .insertInto("server_access_policies")
        .values({
          server_id: serverId,
          mode: input.mode,
          required_permission_id: input.requiredPermissionId,
          required_rank_key: input.requiredRankKey,
          note: input.note,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return { status: "created", data: policy };
    });
  }

  async updateServerById(id: string, input: UpdateServerBody): Promise<Selectable<Servers> | null> {
    return await this.db.transaction().execute(async (trx) => {
      const server = await this.findServerById(id);

      if (!server) return null;

      const serverUpdate: {
        name?: string;
        type?: ServerType;
        environment?: ServerEnv;
        status?: ServerStatus;
        port?: number | null;
        version?: string;
        last_started_at_ms?: string | null;
        last_heartbeat_at_ms?: string | null;
        created_at_ms?: string;
        last_updated_at_ms?: string | null;
      } = {};

      if (input.name !== undefined) {
        serverUpdate.name = input.name;
      }
      if (input.type !== undefined) {
        serverUpdate.type = input.type;
      }
      if (input.environment !== undefined) {
        serverUpdate.environment = input.environment;
      }
      if (input.status !== undefined) {
        serverUpdate.status = input.status;
      }
      if (input.port !== undefined) {
        serverUpdate.port = input.port;
      }
      if (input.version !== undefined) {
        serverUpdate.version = input.version;
      }
      if (input.lastStartedAtMs !== undefined) {
        serverUpdate.last_started_at_ms = input.lastStartedAtMs;
      }
      if (input.lastHeartbeatAtMs !== undefined) {
        serverUpdate.last_heartbeat_at_ms = input.lastHeartbeatAtMs;
      }
      if (input.createdAtMs !== undefined) {
        serverUpdate.created_at_ms = input.createdAtMs;
      }
      if (input.lastUpdatedAtMs !== undefined) {
        serverUpdate.last_updated_at_ms = input.lastUpdatedAtMs;
      }

      if (Object.keys(serverUpdate).length === 0) {
        return null;
      }

      const updatedServer = await trx
        .updateTable("servers")
        .set(serverUpdate)
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst();

      return updatedServer ?? null;
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

  async findLockdownByLockdownId(id: string) {
    return this.db.transaction().execute(async (trx) => {
      const server = await trx
        .selectFrom("lockdowns")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();

      if (!server) {
        return null;
      }

      return server;
    });
  }
}

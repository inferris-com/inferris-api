import { type Kysely, type Selectable, sql, type Transaction } from "kysely";

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
  AuthenticatedCreateLockdownBody,
  CreateServerBody,
  ReplaceServerAccessBody,
  ServerHeartbeatBody,
  ServerHeartbeatMetrics,
  UpdateLockdownBody,
  UpdateServerBody,
} from "./server.schemas.js";
import type { CreateResult, DeleteResult } from "../../shared/results.types.js";
import { toServerAccessPolicyUpdate } from "./server.mapper.js";

export type CreateServerResult = CreateResult<Selectable<Servers>>;
export type CreateLockdownResult = CreateResult<Selectable<Lockdowns>>;
export type CreatePolicyResult =
  | CreateResult<Selectable<ServerAccessPolicies>>
  | { status: "not_found" };
export type DeleteLockdownResult = DeleteResult;

type PlayerSessionIdentity = {
  playerId: string;
  actorId: string;
  mojangId: string;
};

type PlayerSessionRecord = PlayerSessionIdentity & {
  serverId: string;
  sessionEventId: string;
};

export class ServerPgRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async listServers(): Promise<Selectable<Servers>[]> {
    return this.db
      .selectFrom("servers")
      .selectAll()
      .orderBy("environment", "asc")
      .orderBy("type", "asc")
      .orderBy("name", "asc")
      .execute();
  }

  async registerServer(input: CreateServerBody): Promise<Selectable<Servers>> {
    return await this.db.transaction().execute(async (trx) => {
      const now = Date.now().toString();
      const server = await trx
        .insertInto("servers")
        .values({
          name: input.name,
          type: input.type,
          environment: input.environment,
          status: input.status,
          port: input.port,
          version: input.version,
          last_started_at_ms: now,
        })
        .onConflict((oc) =>
          oc.column("name").doUpdateSet({
            type: input.type,
            environment: input.environment,
            status: input.status,
            port: input.port,
            version: input.version,
            last_started_at_ms: now,
            last_updated_at_ms: now,
          }),
        )
        .returningAll()
        .executeTakeFirstOrThrow();

      await trx
        .insertInto("server_access_policies")
        .values({
          server_id: server.id,
          mode: "open",
          required_permission_id: null,
          required_rank_key: null,
          note: "Default open access policy created during server registration.",
        })
        .onConflict((oc) => oc.column("server_id").doNothing())
        .execute();

      return server;
    });
  }

  async startPlayerSession(
    serverId: string,
    player: PlayerSessionIdentity,
  ): Promise<PlayerSessionRecord | null> {
    return this.db.transaction().execute(async (trx) => {
      const server = await trx
        .selectFrom("servers")
        .select("id")
        .where("id", "=", serverId)
        .executeTakeFirst();

      if (!server) {
        return null;
      }

      await trx
        .updateTable("player_session_events")
        .set({
          disconnected_at_ms: sql`get_unix_ms()`,
          disconnect_reason: "replaced",
          updated_at_ms: sql`get_unix_ms()`,
        })
        .where("player_id", "=", player.playerId)
        .where("disconnected_at_ms", "is", null)
        .execute();

      const session = await trx
        .insertInto("player_session_events")
        .values({
          player_id: player.playerId,
          server_id: serverId,
        })
        .returning(["id", "server_id"])
        .executeTakeFirstOrThrow();

      await trx
        .updateTable("players")
        .set({
          last_seen_at_ms: sql`get_unix_ms()`,
          last_server_id: serverId,
        })
        .where("id", "=", player.playerId)
        .execute();

      return {
        ...player,
        serverId: session.server_id,
        sessionEventId: session.id,
      };
    });
  }

  async endPlayerSession(
    serverId: string,
    player: PlayerSessionIdentity,
    reason: string,
  ): Promise<PlayerSessionRecord | null> {
    return this.db.transaction().execute(async (trx) => {
      const session = await trx
        .updateTable("player_session_events")
        .set({
          disconnected_at_ms: sql`get_unix_ms()`,
          disconnect_reason: reason,
          updated_at_ms: sql`get_unix_ms()`,
        })
        .where("player_id", "=", player.playerId)
        .where("server_id", "=", serverId)
        .where("disconnected_at_ms", "is", null)
        .returning(["id", "server_id"])
        .executeTakeFirst();

      if (!session) {
        return null;
      }

      return {
        ...player,
        serverId: session.server_id,
        sessionEventId: session.id,
      };
    });
  }

  async heartbeat(
    serverId: string,
    input: ServerHeartbeatBody,
  ): Promise<PlayerSessionRecord[] | null> {
    return this.db.transaction().execute(async (trx) => {
      const serverUpdate: {
        status?: "online" | "offline";
        port?: number | null;
        version?: string;
        last_heartbeat_at_ms: string;
      } = {
        last_heartbeat_at_ms: Date.now().toString(),
      };

      if (input.status !== undefined) {
        serverUpdate.status = input.status;
      }
      if (input.port !== undefined) {
        serverUpdate.port = input.port;
      }
      if (input.version !== undefined) {
        serverUpdate.version = input.version;
      }

      const updateResult = await trx
        .updateTable("servers")
        .set(serverUpdate)
        .where("id", "=", serverId)
        .executeTakeFirst();

      if (updateResult.numUpdatedRows === 0n) {
        return null;
      }

      await recordHeartbeatObservation(trx, serverId, input);

      if (input.onlineMojangIds.length === 0) {
        return [];
      }

      const rows = await trx
        .selectFrom("player_sessions_current")
        .innerJoin("players", "players.id", "player_sessions_current.player_id")
        .select([
          "players.id as playerId",
          "players.actor_id as actorId",
          "players.mojang_id as mojangId",
          "player_sessions_current.server_id as serverId",
          "player_sessions_current.session_event_id as sessionEventId",
        ])
        .where("player_sessions_current.server_id", "=", serverId)
        .where("players.mojang_id", "in", input.onlineMojangIds)
        .execute();

      return rows.map((row) => ({
        playerId: row.playerId,
        actorId: row.actorId,
        mojangId: row.mojangId,
        serverId: row.serverId,
        sessionEventId: row.sessionEventId,
      }));
    });
  }

  async expireInactiveServers(inactiveBeforeMs: string): Promise<number> {
    return this.db.transaction().execute(async (trx) => {
      const servers = await trx
        .selectFrom("servers")
        .select("id")
        .where("status", "=", "online")
        .where(
          sql`coalesce(last_heartbeat_at_ms, last_started_at_ms, created_at_ms)`,
          "<=",
          inactiveBeforeMs,
        )
        .execute();
      const serverIds = servers.map((server) => server.id);

      if (serverIds.length === 0) {
        return 0;
      }

      await trx
        .updateTable("player_session_events")
        .set({
          disconnected_at_ms: sql`get_unix_ms()`,
          disconnect_reason: "server_inactive",
          updated_at_ms: sql`get_unix_ms()`,
        })
        .where("server_id", "in", serverIds)
        .where("disconnected_at_ms", "is", null)
        .execute();

      const result = await trx
        .updateTable("servers")
        .set({
          status: "offline",
          last_updated_at_ms: sql`get_unix_ms()`,
        })
        .where("id", "in", serverIds)
        .where("status", "=", "online")
        .executeTakeFirst();

      return Number(result.numUpdatedRows);
    });
  }

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

  async createLockdown(
    serverId: string,
    {
      scope,
      reason,
      issuedByActorId,
      requiredRankKey,
      isActive,
      startsAtMs,
      endsAtMs,
    }: AuthenticatedCreateLockdownBody,
  ): Promise<CreateLockdownResult> {
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
  ): Promise<Selectable<ServerAccessPolicies>> {
    return await this.db.transaction().execute(async (trx) => {
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

      return policy;
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

  async updateAccessPolicyByServerId(
    serverId: string,
    input: ReplaceServerAccessBody,
  ): Promise<Selectable<ServerAccessPolicies> | null> {
    const mappedInput = toServerAccessPolicyUpdate(input);

    return await this.db.transaction().execute(async (trx) => {
      const serverExists = await trx
        .selectFrom("servers")
        .selectAll()
        .where("id", "=", serverId)
        .executeTakeFirst();

      if (!serverExists) {
        return null;
      }

      return await trx
        .updateTable("server_access_policies")
        .set(mappedInput)
        .where("server_id", "=", serverId)
        .returningAll()
        .executeTakeFirstOrThrow();
    });
  }

  async updateLockdownByServerId(
    id: string,
    input: UpdateLockdownBody,
  ): Promise<Selectable<Lockdowns> | null> {
    return await this.db.transaction().execute(async (trx) => {
      const serverExists = await trx
        .selectFrom("servers")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();

      const lockdownExists = await trx
        .selectFrom("lockdowns")
        .selectAll()
        .where("server_id", "=", id)
        .executeTakeFirst();

      if (!serverExists) {
        return null;
      }
      if (!lockdownExists) {
        return null;
      }

      const updateLockdown: {
        server_id?: string;
        scope?: "global" | "local";
        reason?: string;
        required_rank_key?: string;
        issued_by_actor_id?: string;
        is_active?: boolean;
        starts_at_ms?: string;
        ends_at_ms?: string | null;
      } = {} as const;

      // PATCH
      if (input.requiredRankKey !== undefined) {
        updateLockdown.required_rank_key = input.requiredRankKey;
      }
      if (input.scope !== undefined) {
        updateLockdown.scope = input.scope;
      }
      if (input.reason !== undefined) {
        updateLockdown.reason = input.reason;
      }
      if (input.isActive !== undefined) {
        updateLockdown.is_active = input.isActive;
      }
      if (input.startsAtMs !== undefined) {
        updateLockdown.starts_at_ms = input.startsAtMs;
      }
      if (input.endsAtMs !== undefined) {
        updateLockdown.ends_at_ms = input.endsAtMs;
      }

      const lockdown = await trx
        .updateTable("lockdowns")
        .set(updateLockdown)
        .set("updated_at_ms", Date.now())
        .returningAll()
        .executeTakeFirstOrThrow();

      return lockdown;
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

  async findServerByName(name: string) {
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
        .where("name", "=", name)
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
        .where("scope", "=", "local")
        .where("is_active", "=", true)
        .where((eb) =>
          eb.or([eb("ends_at_ms", "is", null), eb("ends_at_ms", ">=", Date.now().toString())]),
        )
        .orderBy("starts_at_ms", "desc")
        .executeTakeFirst();

      if (!server) {
        return null;
      }

      return server;
    });
  }

  async findActiveGlobalLockdown() {
    return this.db.transaction().execute(async (trx) => {
      const server = await trx
        .selectFrom("lockdowns")
        .selectAll()
        .where("scope", "=", "global")
        .where("is_active", "=", true)
        .where((eb) =>
          eb.or([eb("ends_at_ms", "is", null), eb("ends_at_ms", ">=", Date.now().toString())]),
        )
        .orderBy("starts_at_ms", "desc")
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

  async deleteServerById(id: string) {
    return await this.db.transaction().execute(async (trx) => {
      const serverExists = await trx.selectFrom("servers").where("id", "=", id).executeTakeFirst();

      if (!serverExists) {
        return { status: "not_found" };
      }

      await trx.deleteFrom("servers").where("id", "=", id).executeTakeFirst();

      return { status: "deleted" };
    });
  }

  async deletePolicyByServerId(serverId: string) {
    return await this.db.transaction().execute(async (trx) => {
      const serverExists = await trx
        .selectFrom("servers")
        .where("id", "=", serverId)
        .executeTakeFirst();

      if (!serverExists) {
        return { status: "not_found" };
      }

      await trx
        .deleteFrom("server_access_policies")
        .where("server_id", "=", serverId)
        .executeTakeFirst();

      return { status: "deleted" };
    });
  }

  async deleteLockdownByServerId(serverId: string) {
    return await this.db.transaction().execute(async (trx) => {
      const serverExists = await trx
        .selectFrom("servers")
        .where("id", "=", serverId)
        .executeTakeFirst();

      if (!serverExists) {
        return { status: "not_found" };
      }

      await trx.deleteFrom("lockdowns").where("server_id", "=", serverId).executeTakeFirst();

      return { status: "deleted" };
    });
  }
}

async function recordHeartbeatObservation(
  db: Kysely<DB> | Transaction<DB>,
  serverId: string,
  input: ServerHeartbeatBody,
): Promise<void> {
  const metrics = input.metrics ?? {};
  const observedAtMs = Date.now().toString();
  const onlinePlayerCount = metrics.onlinePlayerCount ?? input.onlineMojangIds.length;
  const extra = JSON.stringify(metrics.extra ?? {});
  const inserted = await sql<{ id: string }>`
    INSERT INTO server_heartbeat_observations (
      server_id,
      observed_at_ms,
      online_player_count,
      max_players,
      tps_1m,
      tps_5m,
      tps_15m,
      mspt_avg,
      mspt_p95,
      heap_used_bytes,
      heap_max_bytes,
      loaded_chunks,
      loaded_worlds,
      backend_server_count,
      extra
    )
    VALUES (
      ${serverId}::uuid,
      ${observedAtMs}::bigint,
      ${onlinePlayerCount},
      ${nullableMetric(metrics.maxPlayers)},
      ${nullableMetric(metrics.tps1m)},
      ${nullableMetric(metrics.tps5m)},
      ${nullableMetric(metrics.tps15m)},
      ${nullableMetric(metrics.msptAvg)},
      ${nullableMetric(metrics.msptP95)},
      ${nullableMetric(metrics.heapUsedBytes)},
      ${nullableMetric(metrics.heapMaxBytes)},
      ${nullableMetric(metrics.loadedChunks)},
      ${nullableMetric(metrics.loadedWorlds)},
      ${nullableMetric(metrics.backendServerCount)},
      ${extra}::jsonb
    )
    RETURNING id
  `.execute(db);
  const observationId = inserted.rows[0]?.id;

  if (!observationId) {
    return;
  }

  await sql`
    INSERT INTO server_latest_metrics (
      server_id,
      observation_id,
      observed_at_ms,
      online_player_count,
      max_players,
      tps_1m,
      tps_5m,
      tps_15m,
      mspt_avg,
      mspt_p95,
      heap_used_bytes,
      heap_max_bytes,
      loaded_chunks,
      loaded_worlds,
      backend_server_count,
      extra,
      updated_at_ms
    )
    VALUES (
      ${serverId}::uuid,
      ${observationId}::uuid,
      ${observedAtMs}::bigint,
      ${onlinePlayerCount},
      ${nullableMetric(metrics.maxPlayers)},
      ${nullableMetric(metrics.tps1m)},
      ${nullableMetric(metrics.tps5m)},
      ${nullableMetric(metrics.tps15m)},
      ${nullableMetric(metrics.msptAvg)},
      ${nullableMetric(metrics.msptP95)},
      ${nullableMetric(metrics.heapUsedBytes)},
      ${nullableMetric(metrics.heapMaxBytes)},
      ${nullableMetric(metrics.loadedChunks)},
      ${nullableMetric(metrics.loadedWorlds)},
      ${nullableMetric(metrics.backendServerCount)},
      ${extra}::jsonb,
      get_unix_ms()
    )
    ON CONFLICT (server_id) DO UPDATE SET
      observation_id = EXCLUDED.observation_id,
      observed_at_ms = EXCLUDED.observed_at_ms,
      online_player_count = EXCLUDED.online_player_count,
      max_players = EXCLUDED.max_players,
      tps_1m = EXCLUDED.tps_1m,
      tps_5m = EXCLUDED.tps_5m,
      tps_15m = EXCLUDED.tps_15m,
      mspt_avg = EXCLUDED.mspt_avg,
      mspt_p95 = EXCLUDED.mspt_p95,
      heap_used_bytes = EXCLUDED.heap_used_bytes,
      heap_max_bytes = EXCLUDED.heap_max_bytes,
      loaded_chunks = EXCLUDED.loaded_chunks,
      loaded_worlds = EXCLUDED.loaded_worlds,
      backend_server_count = EXCLUDED.backend_server_count,
      extra = EXCLUDED.extra,
      updated_at_ms = EXCLUDED.updated_at_ms
  `.execute(db);
}

function nullableMetric(
  value: ServerHeartbeatMetrics[keyof ServerHeartbeatMetrics],
): number | null {
  return typeof value === "number" ? value : null;
}

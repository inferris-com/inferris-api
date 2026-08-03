import { type Kysely, type Selectable, sql, type Transaction } from "kysely";

import type {
  DB,
  Lockdowns,
  ServerAccessPolicies,
  ServerEnv,
  Servers,
  ServerType,
} from "@/db/types.js";
import type {
  AuthenticatedCreateLockdownBody,
  CreateServerBody,
  ReplaceServerAccessBody,
  ServerHeartbeatBody,
  ServerHeartbeatMetrics,
  UpdateLockdownBody,
  UpdateServerBody,
} from "@/module/server/server.schemas.js";
import type { CreateResult, DeleteResult } from "@/shared/results.types.js";
import {
  toServerAccessPolicyUpdate,
  type ServerWithPresence,
} from "@/module/server/server.mapper.js";

export type CreateServerResult = CreateResult<Selectable<Servers>>;
export type CreateLockdownResult = CreateResult<Selectable<Lockdowns>>;
export type CreatePolicyResult =
  | CreateResult<Selectable<ServerAccessPolicies>>
  | { status: "not_found" };
export type DeleteLockdownResult = DeleteResult;
type ServerPresenceStatus = "online" | "offline";

type PlayerSessionIdentity = {
  playerId: string;
  actorId: string;
  mojangId: string;
};

type PlayerSessionRecord = PlayerSessionIdentity & {
  proxyServerId: string;
  networkSessionId: string;
};

type BackendSessionRecord = PlayerSessionIdentity & {
  networkSessionId: string;
  serverId: string;
  backendSessionId: string;
};

export class ServerPgRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async listServers(): Promise<ServerWithPresence[]> {
    const rows = await sql<Selectable<Servers> & { status: ServerPresenceStatus }>`
      SELECT
        s.*,
        CASE
          WHEN count(si.id) FILTER (WHERE si.state IN ('active', 'draining')) > 0 THEN 'online'
          ELSE 'offline'
        END AS status
      FROM servers s
      LEFT JOIN server_instances si ON si.server_id = s.id
      GROUP BY s.id
      ORDER BY s.environment ASC, s.type ASC, s.name ASC
    `.execute(this.db);

    return rows.rows;
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
          port: input.port,
        })
        .onConflict((oc) =>
          oc.column("name").doUpdateSet({
            type: input.type,
            environment: input.environment,
            port: input.port,
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

  async startNetworkSession(
    serverId: string,
    player: PlayerSessionIdentity,
  ): Promise<PlayerSessionRecord | null> {
    return this.db.transaction().execute(async (trx) => {
      const server = await trx
        .selectFrom("servers")
        .select(["id", "type"])
        .where("id", "=", serverId)
        .executeTakeFirst();

      if (!server || server.type !== "velocity") {
        return null;
      }

      await trx
        .updateTable("network_sessions")
        .set({
          disconnected_at_ms: sql`get_unix_ms()`,
          disconnect_reason: "replaced",
          updated_at_ms: sql`get_unix_ms()`,
        })
        .where("player_id", "=", player.playerId)
        .where("disconnected_at_ms", "is", null)
        .execute();

      const session = await trx
        .insertInto("network_sessions")
        .values({
          player_id: player.playerId,
          proxy_server_id: serverId,
        })
        .returning(["id", "proxy_server_id"])
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
        proxyServerId: session.proxy_server_id,
        networkSessionId: session.id,
      };
    });
  }

  async endNetworkSession(
    serverId: string,
    player: PlayerSessionIdentity,
    reason: string,
  ): Promise<PlayerSessionRecord | null> {
    return this.db.transaction().execute(async (trx) => {
      const session = await trx
        .updateTable("network_sessions")
        .set({
          disconnected_at_ms: sql`get_unix_ms()`,
          disconnect_reason: reason,
          updated_at_ms: sql`get_unix_ms()`,
        })
        .where("player_id", "=", player.playerId)
        .where("proxy_server_id", "=", serverId)
        .where("disconnected_at_ms", "is", null)
        .returning(["id", "proxy_server_id"])
        .executeTakeFirst();

      if (!session) {
        return null;
      }

      return {
        ...player,
        proxyServerId: session.proxy_server_id,
        networkSessionId: session.id,
      };
    });
  }

  async startBackendSession(
    serverId: string,
    player: PlayerSessionIdentity,
  ): Promise<BackendSessionRecord | null> {
    return this.db.transaction().execute(async (trx) => {
      const server = await trx
        .selectFrom("servers")
        .select(["id", "type"])
        .where("id", "=", serverId)
        .executeTakeFirst();

      if (!server || server.type !== "paper") {
        return null;
      }

      const networkSession = await trx
        .selectFrom("network_sessions_current")
        .select("network_session_id")
        .where("player_id", "=", player.playerId)
        .executeTakeFirst();

      if (!networkSession) {
        return null;
      }

      await trx
        .updateTable("backend_sessions")
        .set({
          left_at_ms: sql`get_unix_ms()`,
          leave_reason: "transfer",
          updated_at_ms: sql`get_unix_ms()`,
        })
        .where("network_session_id", "=", networkSession.network_session_id)
        .where("left_at_ms", "is", null)
        .execute();

      const visit = await trx
        .insertInto("backend_sessions")
        .values({
          network_session_id: networkSession.network_session_id,
          player_id: player.playerId,
          backend_server_id: serverId,
        })
        .returning(["id", "network_session_id", "backend_server_id"])
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
        networkSessionId: visit.network_session_id,
        serverId: visit.backend_server_id,
        backendSessionId: visit.id,
      };
    });
  }

  async endBackendSession(
    serverId: string,
    player: PlayerSessionIdentity,
    reason: string,
  ): Promise<BackendSessionRecord | null> {
    return this.db.transaction().execute(async (trx) => {
      const visit = await trx
        .updateTable("backend_sessions")
        .set({
          left_at_ms: sql`get_unix_ms()`,
          leave_reason: reason,
          updated_at_ms: sql`get_unix_ms()`,
        })
        .where("player_id", "=", player.playerId)
        .where("backend_server_id", "=", serverId)
        .where("left_at_ms", "is", null)
        .returning(["id", "network_session_id", "backend_server_id"])
        .executeTakeFirst();

      if (!visit) {
        return null;
      }

      return {
        ...player,
        networkSessionId: visit.network_session_id,
        serverId: visit.backend_server_id,
        backendSessionId: visit.id,
      };
    });
  }

  async heartbeat(
    serverId: string,
    input: ServerHeartbeatBody,
  ): Promise<PlayerSessionRecord[] | null> {
    return this.db.transaction().execute(async (trx) => {
      const server = await trx
        .selectFrom("servers")
        .select(["id", "type"])
        .where("id", "=", serverId)
        .executeTakeFirst();

      if (!server) {
        return null;
      }

      await recordHeartbeatObservation(trx, serverId, input);

      if (input.onlineMojangIds.length === 0) {
        return [];
      }

      const rows =
        server.type === "velocity"
          ? await trx
              .selectFrom("network_sessions_current")
              .innerJoin("players", "players.id", "network_sessions_current.player_id")
              .select([
                "players.id as playerId",
                "players.actor_id as actorId",
                "players.mojang_id as mojangId",
                "network_sessions_current.proxy_server_id as proxyServerId",
                "network_sessions_current.network_session_id as networkSessionId",
              ])
              .where("network_sessions_current.proxy_server_id", "=", serverId)
              .where("players.mojang_id", "in", input.onlineMojangIds)
              .execute()
          : await trx
              .selectFrom("backend_sessions_current")
              .innerJoin("players", "players.id", "backend_sessions_current.player_id")
              .innerJoin(
                "network_sessions_current",
                "network_sessions_current.network_session_id",
                "backend_sessions_current.network_session_id",
              )
              .select([
                "players.id as playerId",
                "players.actor_id as actorId",
                "players.mojang_id as mojangId",
                "network_sessions_current.proxy_server_id as proxyServerId",
                "network_sessions_current.network_session_id as networkSessionId",
              ])
              .where("backend_sessions_current.backend_server_id", "=", serverId)
              .where("players.mojang_id", "in", input.onlineMojangIds)
              .execute();

      return rows.map((row) => ({
        playerId: row.playerId,
        actorId: row.actorId,
        mojangId: row.mojangId,
        proxyServerId: row.proxyServerId,
        networkSessionId: row.networkSessionId,
      }));
    });
  }

  async expireInactiveServers(inactiveBeforeMs: string): Promise<number> {
    return this.db.transaction().execute(async (trx) => {
      await sql`
        UPDATE network_sessions ns
        SET disconnected_at_ms = get_unix_ms(),
            disconnect_reason = CASE si.state
              WHEN 'superseded' THEN 'proxy_superseded'
              WHEN 'lost' THEN 'proxy_lost'
              ELSE 'proxy_stopped'
            END,
            updated_at_ms = get_unix_ms()
        FROM server_instances si
        WHERE si.id = ns.proxy_server_instance_id
          AND si.state IN ('stopped', 'lost', 'superseded')
          AND ns.disconnected_at_ms IS NULL
      `.execute(trx);

      await sql`
        UPDATE backend_sessions bs
        SET left_at_ms = get_unix_ms(),
            leave_reason = CASE si.state
              WHEN 'superseded' THEN 'backend_superseded'
              WHEN 'lost' THEN 'backend_lost'
              ELSE 'backend_stopped'
            END,
            updated_at_ms = get_unix_ms()
        FROM server_instances si
        WHERE si.id = bs.backend_server_instance_id
          AND si.state IN ('stopped', 'lost', 'superseded')
          AND bs.left_at_ms IS NULL
      `.execute(trx);

      const instances = await trx
        .selectFrom("server_instances")
        .innerJoin("servers", "servers.id", "server_instances.server_id")
        .select(["server_instances.id", "servers.type"])
        .where("server_instances.state", "in", ["active", "draining"])
        .where(
          sql`coalesce(server_instances.last_heartbeat_at_ms, server_instances.started_at_ms, server_instances.created_at_ms)`,
          "<=",
          inactiveBeforeMs,
        )
        .execute();
      const proxyInstanceIds = instances
        .filter((instance) => instance.type === "velocity")
        .map((instance) => instance.id);
      const backendInstanceIds = instances
        .filter((instance) => instance.type !== "velocity")
        .map((instance) => instance.id);
      const instanceIds = instances.map((instance) => instance.id);

      if (instanceIds.length === 0) {
        return 0;
      }

      if (proxyInstanceIds.length > 0) {
        await trx
          .updateTable("network_sessions")
          .set({
            disconnected_at_ms: sql`get_unix_ms()`,
            disconnect_reason: "proxy_lost",
            updated_at_ms: sql`get_unix_ms()`,
          })
          .where("proxy_server_instance_id", "in", proxyInstanceIds)
          .where("disconnected_at_ms", "is", null)
          .execute();
      }

      if (backendInstanceIds.length > 0) {
        await trx
          .updateTable("backend_sessions")
          .set({
            left_at_ms: sql`get_unix_ms()`,
            leave_reason: "backend_lost",
            updated_at_ms: sql`get_unix_ms()`,
          })
          .where("backend_server_instance_id", "in", backendInstanceIds)
          .where("left_at_ms", "is", null)
          .execute();
      }

      const result = await trx
        .updateTable("server_instances")
        .set({
          state: "lost",
          lost_at_ms: sql`get_unix_ms()`,
          updated_at_ms: sql`get_unix_ms()`,
        })
        .where("id", "in", instanceIds)
        .where("state", "in", ["active", "draining"])
        .executeTakeFirst();

      await trx
        .updateTable("server_instance_tokens")
        .set({
          revoked_at_ms: sql`get_unix_ms()`,
          revoked_reason: "lost",
        })
        .where("server_instance_id", "in", instanceIds)
        .where("revoked_at_ms", "is", null)
        .execute();

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
          port: input.port,
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

  async updateServerById(id: string, input: UpdateServerBody): Promise<ServerWithPresence | null> {
    return await this.db.transaction().execute(async (trx) => {
      const server = await this.findServerById(id);

      if (!server) return null;

      const serverUpdate: {
        name?: string;
        type?: ServerType;
        environment?: ServerEnv;
        port?: number | null;
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
      if (input.port !== undefined) {
        serverUpdate.port = input.port;
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

      return updatedServer ? { ...updatedServer, status: server.status ?? "offline" } : null;
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

  async findServerById(id: string): Promise<ServerWithPresence | null> {
    const rows = await sql<Selectable<Servers> & { status: ServerPresenceStatus }>`
      SELECT
        s.*,
        CASE
          WHEN count(si.id) FILTER (WHERE si.state IN ('active', 'draining')) > 0 THEN 'online'
          ELSE 'offline'
        END AS status
      FROM servers s
      LEFT JOIN server_instances si ON si.server_id = s.id
      WHERE s.id = ${id}::uuid
      GROUP BY s.id
    `.execute(this.db);

    return rows.rows[0] ?? null;
  }

  async findServerByName(name: string): Promise<ServerWithPresence | null> {
    const rows = await sql<Selectable<Servers> & { status: ServerPresenceStatus }>`
      SELECT
        s.*,
        CASE
          WHEN count(si.id) FILTER (WHERE si.state IN ('active', 'draining')) > 0 THEN 'online'
          ELSE 'offline'
        END AS status
      FROM servers s
      LEFT JOIN server_instances si ON si.server_id = s.id
      WHERE s.name = ${name}
      GROUP BY s.id
    `.execute(this.db);

    return rows.rows[0] ?? null;
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

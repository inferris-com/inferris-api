import { sql } from "kysely";

import type { DbExecutor } from "@/db/index.js";
import type {
  RegisterServerInstanceBody,
  ServerInstanceEventBody,
  ServerInstanceHeartbeatBody,
  ServerInstanceMetricsBody,
  ServerInstancePresenceBody,
} from "@/module/server-instance/server-instance.schemas.js";

export type ServerInstanceRow = {
  id: string;
  server_id: string;
  server_type: string;
  state: string;
  runtime_port: number | null;
  version: string | null;
  started_at_ms: string;
  draining_at_ms: string | null;
  stopped_at_ms: string | null;
  lost_at_ms: string | null;
  superseded_at_ms: string | null;
  last_heartbeat_at_ms: string | null;
  heartbeat_interval_ms: string | null;
  last_event_sequence: string;
  is_synthetic_backfill: boolean;
  created_at_ms: string;
  updated_at_ms: string | null;
};

export type RegisterInstanceResult =
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "created" | "idempotent"; instance: ServerInstanceRow };

export type RegisterInstanceAuth = {
  apiKeyId: string | null;
  bypassServerBinding: boolean;
};

export type HeartbeatResult =
  | {
      status?: "active";
      serverInstanceId: string;
      state: string;
      lastHeartbeatAtMs: string;
    }
  | { status: "inactive" };

export type MetricsResult =
  | {
      status?: "active";
      serverInstanceId: string;
      observationId: string;
      observedAtMs: string;
    }
  | { status: "inactive" };

export type SessionIdentity = {
  actorId: string;
  playerId: string;
  mojangId: string;
  proxyServerId: string;
  networkSessionId: string;
};

export type PresenceResult =
  | {
      status: "inactive";
    }
  | {
      status: "active" | "stale";
      serverInstanceId: string;
      observedAtMs: string;
      observedPlayerCount: number;
      closedNetworkSessionCount: number;
      closedBackendSessionCount: number;
      observedSessions: SessionIdentity[];
      closedSessions: Pick<SessionIdentity, "playerId">[];
    };

export type EventResult =
  | {
      status: "processed" | "idempotent";
      serverInstanceId: string;
      eventId: string;
      sequence: string;
      type: string;
      startedSession?: SessionIdentity;
      closedSessions: Pick<SessionIdentity, "playerId">[];
    }
  | { status: "sequence_gap"; expectedSequence: string }
  | { status: "conflict" }
  | { status: "forbidden" }
  | { status: "inactive" }
  | { status: "invalid"; message: string };

type InstanceIdentity = {
  id: string;
  serverId: string;
  serverType: string;
};

type PlayerIdentity = {
  playerId: string;
  actorId: string;
  mojangId: string;
};

export class ServerInstancePgRepository {
  constructor(private readonly db: DbExecutor) {}

  async registerInstance(
    input: RegisterServerInstanceBody,
    tokenHash: string,
    auth: RegisterInstanceAuth = { apiKeyId: null, bypassServerBinding: true },
  ): Promise<RegisterInstanceResult> {
    return this.db.transaction().execute(async (trx) => {
      const server = await trx
        .selectFrom("servers")
        .select(["id"])
        .where("id", "=", input.serverId)
        .executeTakeFirst();

      if (!server) {
        return { status: "not_found" };
      }

      if (!auth.bypassServerBinding) {
        const bound = await sql<{ ok: number }>`
          SELECT 1 AS ok
          FROM server_registration_api_keys
          WHERE api_key_id = ${auth.apiKeyId}::uuid
            AND server_id = ${input.serverId}::uuid
          LIMIT 1
        `.execute(trx);

        if (!bound.rows[0]) {
          return { status: "forbidden" };
        }
      }

      const existingBoot = await this.findActiveInstanceByBootId(trx, input.serverId, input.bootId);

      if (existingBoot) {
        await trx
          .insertInto("server_instance_tokens")
          .values({
            server_instance_id: existingBoot.id,
            token_hash: tokenHash,
          })
          .execute();

        return { status: "idempotent", instance: existingBoot };
      }

      const superseded = await sql<{ id: string; server_type: string }>`
        WITH superseded AS (
          UPDATE server_instances
          SET state = 'superseded',
              superseded_at_ms = get_unix_ms(),
              updated_at_ms = get_unix_ms()
          WHERE server_id = ${input.serverId}::uuid
            AND state IN ('active', 'draining')
          RETURNING id
        )
        SELECT superseded.id, servers.type::text AS server_type
        FROM superseded
        INNER JOIN servers ON servers.id = ${input.serverId}::uuid
      `.execute(trx);

      const supersededProxyIds = superseded.rows
        .filter((row) => row.server_type === "velocity")
        .map((row) => row.id);
      const supersededBackendIds = superseded.rows
        .filter((row) => row.server_type !== "velocity")
        .map((row) => row.id);

      if (supersededProxyIds.length > 0) {
        await this.closeProxyOwnedSessions(
          trx,
          supersededProxyIds,
          "get_unix_ms()",
          "proxy_superseded",
        );
      }

      if (supersededBackendIds.length > 0) {
        await this.closeBackendInstanceSessions(
          trx,
          supersededBackendIds,
          "get_unix_ms()",
          "backend_superseded",
        );
      }

      if (superseded.rows.length > 0) {
        await sql`
          UPDATE server_instance_tokens sit
          SET revoked_at_ms = get_unix_ms(),
              revoked_reason = 'superseded'
          WHERE sit.server_instance_id IN (${sql.join(superseded.rows.map((row) => row.id))})
            AND sit.revoked_at_ms IS NULL
        `.execute(trx);
      }

      const rows = await sql<ServerInstanceRow>`
        INSERT INTO server_instances (
          server_id,
          boot_id,
          runtime_port,
          version,
          heartbeat_interval_ms,
          last_heartbeat_at_ms
        )
        VALUES (
          ${input.serverId}::uuid,
          ${input.bootId},
          ${input.runtimePort ?? null},
          ${input.version ?? null},
          ${input.heartbeatIntervalMs ?? null},
          get_unix_ms()
        )
        RETURNING
          id,
          server_id,
          boot_id,
          (SELECT type::text FROM servers WHERE servers.id = server_instances.server_id) AS server_type,
          state::text,
          runtime_port,
          version,
          started_at_ms::text,
          draining_at_ms::text,
          stopped_at_ms::text,
          lost_at_ms::text,
          superseded_at_ms::text,
          last_heartbeat_at_ms::text,
          heartbeat_interval_ms::text,
          last_event_sequence::text,
          is_synthetic_backfill,
          created_at_ms::text,
          updated_at_ms::text
      `.execute(trx);

      const instance = rows.rows[0];

      if (!instance) {
        throw new Error("Server instance insert did not return a row.");
      }

      await trx
        .insertInto("server_instance_tokens")
        .values({
          server_instance_id: instance.id,
          token_hash: tokenHash,
        })
        .execute();

      return { status: "created", instance };
    });
  }

  async getInstance(instanceId: string): Promise<ServerInstanceRow | null> {
    const rows = await sql<ServerInstanceRow>`
      SELECT
        si.id,
        si.server_id,
        s.type::text AS server_type,
        si.state::text,
        si.runtime_port,
        si.version,
        si.started_at_ms::text,
        si.draining_at_ms::text,
        si.stopped_at_ms::text,
        si.lost_at_ms::text,
        si.superseded_at_ms::text,
        si.last_heartbeat_at_ms::text,
        si.heartbeat_interval_ms::text,
        si.last_event_sequence::text,
        si.is_synthetic_backfill,
        si.created_at_ms::text,
        si.updated_at_ms::text
      FROM server_instances si
      INNER JOIN servers s ON s.id = si.server_id
      WHERE si.id = ${instanceId}::uuid
    `.execute(this.db);

    return rows.rows[0] ?? null;
  }

  async heartbeat(
    instance: InstanceIdentity,
    input: ServerInstanceHeartbeatBody,
  ): Promise<HeartbeatResult> {
    const receivedAtMs = Date.now().toString();
    const rows = await sql<{
      id: string;
      state: string;
      last_heartbeat_at_ms: string;
    }>`
      UPDATE server_instances
      SET last_heartbeat_at_ms = GREATEST(COALESCE(last_heartbeat_at_ms, 0), ${receivedAtMs}::bigint),
          heartbeat_interval_ms = COALESCE(${input.heartbeatIntervalMs ?? null}::bigint, heartbeat_interval_ms),
          runtime_port = COALESCE(${input.runtimePort ?? null}, runtime_port),
          version = COALESCE(${input.version ?? null}, version),
          updated_at_ms = get_unix_ms()
      WHERE id = ${instance.id}::uuid
        AND server_id = ${instance.serverId}::uuid
        AND state IN ('active', 'draining')
      RETURNING id, state::text, last_heartbeat_at_ms::text
    `.execute(this.db);

    const row = rows.rows[0];

    if (!row) {
      return { status: "inactive" };
    }

    return {
      serverInstanceId: row.id,
      state: row.state,
      lastHeartbeatAtMs: row.last_heartbeat_at_ms,
    };
  }

  async recordMetrics(
    instance: InstanceIdentity,
    input: ServerInstanceMetricsBody,
  ): Promise<MetricsResult> {
    const observedAtMs = input.observedAtMs ?? Date.now().toString();
    return this.db.transaction().execute(async (trx) => {
      const active = await this.lockActiveInstance(trx, instance);

      if (!active) {
        return { status: "inactive" };
      }

      const rows = await sql<{
        id: string;
        observed_at_ms: string;
      }>`
      INSERT INTO server_heartbeat_observations (
        server_id,
        server_instance_id,
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
        ${instance.serverId}::uuid,
        ${instance.id}::uuid,
        ${observedAtMs}::bigint,
        ${input.onlinePlayerCount ?? null},
        ${input.maxPlayers ?? null},
        ${input.tps1m ?? null},
        ${input.tps5m ?? null},
        ${input.tps15m ?? null},
        ${input.msptAvg ?? null},
        ${input.msptP95 ?? null},
        ${input.heapUsedBytes ?? null},
        ${input.heapMaxBytes ?? null},
        ${input.loadedChunks ?? null},
        ${input.loadedWorlds ?? null},
        ${input.backendServerCount ?? null},
        ${JSON.stringify(input.extra ?? {})}::jsonb
      )
      RETURNING id, observed_at_ms::text
    `.execute(trx);

      const observation = rows.rows[0];

      if (!observation) {
        throw new Error("Server instance metric insert did not return a row.");
      }

      await sql`
      INSERT INTO server_latest_metrics (
        server_id,
        server_instance_id,
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
        ${instance.serverId}::uuid,
        ${instance.id}::uuid,
        ${observation.id}::uuid,
        ${observation.observed_at_ms}::bigint,
        ${input.onlinePlayerCount ?? null},
        ${input.maxPlayers ?? null},
        ${input.tps1m ?? null},
        ${input.tps5m ?? null},
        ${input.tps15m ?? null},
        ${input.msptAvg ?? null},
        ${input.msptP95 ?? null},
        ${input.heapUsedBytes ?? null},
        ${input.heapMaxBytes ?? null},
        ${input.loadedChunks ?? null},
        ${input.loadedWorlds ?? null},
        ${input.backendServerCount ?? null},
        ${JSON.stringify(input.extra ?? {})}::jsonb,
        get_unix_ms()
      )
      ON CONFLICT (server_id) DO UPDATE SET
        server_instance_id = excluded.server_instance_id,
        observation_id = excluded.observation_id,
        observed_at_ms = excluded.observed_at_ms,
        online_player_count = excluded.online_player_count,
        max_players = excluded.max_players,
        tps_1m = excluded.tps_1m,
        tps_5m = excluded.tps_5m,
        tps_15m = excluded.tps_15m,
        mspt_avg = excluded.mspt_avg,
        mspt_p95 = excluded.mspt_p95,
        heap_used_bytes = excluded.heap_used_bytes,
        heap_max_bytes = excluded.heap_max_bytes,
        loaded_chunks = excluded.loaded_chunks,
        loaded_worlds = excluded.loaded_worlds,
        backend_server_count = excluded.backend_server_count,
        extra = excluded.extra,
        updated_at_ms = excluded.updated_at_ms
      WHERE server_latest_metrics.observed_at_ms <= excluded.observed_at_ms
    `.execute(trx);

      return {
        serverInstanceId: instance.id,
        observationId: observation.id,
        observedAtMs: observation.observed_at_ms,
      };
    });
  }

  async reconcilePresence(
    instance: InstanceIdentity,
    input: ServerInstancePresenceBody,
  ): Promise<PresenceResult> {
    const observedAtMs = input.observedAtMs ?? Date.now().toString();
    const onlineMojangIds = input.onlineMojangIds ? unique(input.onlineMojangIds) : null;

    return this.db.transaction().execute(async (trx) => {
      const active = await this.lockActiveInstance(trx, instance);

      if (!active) {
        return { status: "inactive" };
      }

      const accepted = await this.acceptPresenceSnapshot(
        trx,
        instance.id,
        input.snapshotSequence.toString(),
        observedAtMs,
      );

      if (!accepted) {
        return {
          status: "stale",
          serverInstanceId: instance.id,
          observedAtMs,
          observedPlayerCount: onlineMojangIds?.length ?? 0,
          closedNetworkSessionCount: 0,
          closedBackendSessionCount: 0,
          observedSessions: [],
          closedSessions: [],
        };
      }

      const observedSessions = onlineMojangIds
        ? await this.findObservedSessions(trx, instance, onlineMojangIds)
        : [];
      const closedNetworkSessionCount =
        instance.serverType === "velocity" && onlineMojangIds
          ? await this.closeNetworkSessionsMissingFromPresence(
              trx,
              instance.id,
              onlineMojangIds,
              observedAtMs,
            )
          : { count: 0, sessions: [] };
      const closedBackendSessionCount =
        instance.serverType === "velocity" || !onlineMojangIds
          ? { count: 0, sessions: [] }
          : await this.closeBackendSessionsMissingFromPresence(
              trx,
              instance.id,
              onlineMojangIds,
              observedAtMs,
            );

      return {
        status: "active",
        serverInstanceId: instance.id,
        observedAtMs,
        observedPlayerCount: onlineMojangIds?.length ?? 0,
        closedNetworkSessionCount: closedNetworkSessionCount.count,
        closedBackendSessionCount: closedBackendSessionCount.count,
        observedSessions,
        closedSessions: [
          ...closedNetworkSessionCount.sessions,
          ...closedBackendSessionCount.sessions,
        ],
      };
    });
  }

  async processEvent(
    instance: InstanceIdentity,
    input: ServerInstanceEventBody,
    resolvePlayer: (payload: Record<string, unknown>) => Promise<PlayerIdentity | null>,
  ): Promise<EventResult> {
    return this.db.transaction().execute(async (trx) => {
      const existing = await sql<{
        event_id: string;
        sequence: string;
        type: string;
        payload: unknown;
        processing_result: Record<string, unknown>;
      }>`
        SELECT event_id, sequence::text, type::text, payload, processing_result
        FROM server_events
        WHERE server_instance_id = ${instance.id}::uuid
          AND (event_id = ${input.eventId} OR sequence = ${input.sequence}::bigint)
        LIMIT 1
      `.execute(trx);

      const existingEvent = existing.rows[0];

      if (existingEvent) {
        const sameEvent =
          existingEvent.event_id === input.eventId &&
          existingEvent.sequence === input.sequence.toString() &&
          existingEvent.type === input.type &&
          canonicalJson(existingEvent.payload) === canonicalJson(input.payload);

        if (!sameEvent) {
          return { status: "conflict" };
        }

        const prior = existingEvent.processing_result;

        const startedSession = sessionIdentityPayload(prior.startedSession);

        return {
          status: "idempotent",
          serverInstanceId: instance.id,
          eventId: input.eventId,
          sequence: input.sequence.toString(),
          type: input.type,
          closedSessions: playerIdListPayload(prior.closedSessions),
          ...(startedSession ? { startedSession } : {}),
        };
      }

      const cursorRows = await sql<{ last_event_sequence: string }>`
        SELECT last_event_sequence::text
        FROM server_instances
        WHERE id = ${instance.id}::uuid
          AND server_id = ${instance.serverId}::uuid
          AND state IN ('active', 'draining')
        FOR UPDATE
      `.execute(trx);
      const cursor = cursorRows.rows[0];

      if (!cursor) {
        return { status: "inactive" };
      }
      const expectedSequence = Number(cursor.last_event_sequence) + 1;

      if (input.sequence !== expectedSequence) {
        return { status: "sequence_gap", expectedSequence: expectedSequence.toString() };
      }

      if (isSessionEvent(input.type) && instance.serverType !== "velocity") {
        return { status: "forbidden" };
      }

      const eventPayload = input.payload;
      const processingResult = await this.applyEvent(
        trx,
        instance,
        input,
        eventPayload,
        resolvePlayer,
      );

      if (processingResult.invalid) {
        return {
          status: "invalid",
          message: stringPayload(processingResult.reason) ?? "Invalid server event payload.",
        };
      }

      await sql`
        INSERT INTO server_events (
          server_instance_id,
          event_id,
          sequence,
          type,
          payload,
          processing_result,
          occurred_at_ms
        )
        VALUES (
          ${instance.id}::uuid,
          ${input.eventId},
          ${input.sequence}::bigint,
          ${input.type}::server_event_type,
          ${JSON.stringify(eventPayload)}::jsonb,
          ${JSON.stringify(processingResult)}::jsonb,
          ${input.occurredAtMs}::bigint
        )
      `.execute(trx);

      await sql`
        UPDATE server_instances
        SET last_event_sequence = ${input.sequence}::bigint,
            updated_at_ms = get_unix_ms()
        WHERE id = ${instance.id}::uuid
      `.execute(trx);

      const startedSession = sessionIdentityPayload(processingResult.startedSession);

      return {
        status: "processed",
        serverInstanceId: instance.id,
        eventId: input.eventId,
        sequence: input.sequence.toString(),
        type: input.type,
        closedSessions: playerIdListPayload(processingResult.closedSessions),
        ...(startedSession ? { startedSession } : {}),
      };
    });
  }

  private async applyEvent(
    trx: DbExecutor,
    instance: InstanceIdentity,
    input: ServerInstanceEventBody,
    payload: Record<string, unknown>,
    resolvePlayer: (payload: Record<string, unknown>) => Promise<PlayerIdentity | null>,
  ): Promise<Record<string, unknown>> {
    const occurredAtMs = input.occurredAtMs ?? Date.now().toString();

    if (input.type === "SERVER_SHUTTING_DOWN") {
      await this.markInstanceDraining(trx, instance.id, occurredAtMs);
      return { state: "draining" };
    }

    if (input.type === "SERVER_STOPPED") {
      const closedSessions = await this.markInstanceStopped(trx, instance, occurredAtMs);
      return { state: "stopped", closedSessions };
    }

    if (input.type === "NETWORK_SESSION_STARTED") {
      const player = await resolvePlayer(payload);
      if (!player) {
        return { invalid: true, reason: "Player identity could not be resolved." };
      }

      const networkSessionId = stringPayload(payload.networkSessionId);

      if (!networkSessionId) {
        return { invalid: true, reason: "Network session id is required." };
      }

      const result = await this.startNetworkSession(
        trx,
        instance,
        player,
        networkSessionId,
        occurredAtMs,
      );
      return {
        networkSessionId,
        startedSession: {
          actorId: player.actorId,
          playerId: player.playerId,
          mojangId: player.mojangId,
          proxyServerId: instance.serverId,
          networkSessionId,
        },
        closedSessions: result.closedSessions,
      };
    }

    if (input.type === "BACKEND_CONNECTED") {
      const networkSessionId = stringPayload(payload.networkSessionId);
      const backendServerId = stringPayload(payload.backendServerId);

      if (!networkSessionId || !backendServerId) {
        return { invalid: true, reason: "Network session id and backend server id are required." };
      }

      const backendSessionId = await this.connectBackend(
        trx,
        instance,
        networkSessionId,
        backendServerId,
        stringPayload(payload.backendServerInstanceId),
        occurredAtMs,
      );

      if (!backendSessionId) {
        return {
          invalid: true,
          reason: "Backend attribution or network session ownership is invalid.",
        };
      }

      return { networkSessionId, backendSessionId };
    }

    const networkSessionId = stringPayload(payload.networkSessionId);

    if (!networkSessionId) {
      return { invalid: true, reason: "Network session id is required." };
    }

    const closedSessions = await this.endNetworkSession(
      trx,
      instance,
      networkSessionId,
      occurredAtMs,
    );

    if (closedSessions.length === 0) {
      return { invalid: true, reason: "Network session is not owned by this proxy instance." };
    }

    return { networkSessionId, closedSessions };
  }

  private async markInstanceDraining(
    trx: DbExecutor,
    serverInstanceId: string,
    occurredAtMs: string,
  ): Promise<void> {
    await sql`
      UPDATE server_instances
      SET state = 'draining',
          draining_at_ms = COALESCE(draining_at_ms, ${occurredAtMs}::bigint),
          updated_at_ms = get_unix_ms()
      WHERE id = ${serverInstanceId}::uuid
        AND state = 'active'
    `.execute(trx);
  }

  private async markInstanceStopped(
    trx: DbExecutor,
    instance: InstanceIdentity,
    occurredAtMs: string,
  ): Promise<Pick<SessionIdentity, "playerId">[]> {
    await sql`
      UPDATE server_instances
      SET state = 'stopped',
          stopped_at_ms = COALESCE(stopped_at_ms, ${occurredAtMs}::bigint),
          updated_at_ms = get_unix_ms()
      WHERE id = ${instance.id}::uuid
        AND state IN ('active', 'draining')
    `.execute(trx);

    await sql`
      UPDATE server_instance_tokens
      SET revoked_at_ms = COALESCE(revoked_at_ms, ${occurredAtMs}::bigint),
          revoked_reason = COALESCE(revoked_reason, 'stopped')
      WHERE server_instance_id = ${instance.id}::uuid
        AND revoked_at_ms IS NULL
    `.execute(trx);

    if (instance.serverType === "velocity") {
      return this.closeProxyOwnedSessions(trx, [instance.id], occurredAtMs, "proxy_stopped");
    } else {
      return this.closeBackendInstanceSessions(trx, [instance.id], occurredAtMs, "backend_stopped");
    }
  }

  private async startNetworkSession(
    trx: DbExecutor,
    instance: InstanceIdentity,
    player: PlayerIdentity,
    networkSessionId: string,
    occurredAtMs: string,
  ): Promise<{ closedSessions: Pick<SessionIdentity, "playerId">[] }> {
    const closed = await sql<{ player_id: string }>`
      UPDATE network_sessions
      SET disconnected_at_ms = ${occurredAtMs}::bigint,
          disconnect_reason = 'replaced',
          updated_at_ms = get_unix_ms()
      WHERE player_id = ${player.playerId}::uuid
        AND disconnected_at_ms IS NULL
      RETURNING player_id
    `.execute(trx);

    const rows = await sql<{ id: string }>`
      INSERT INTO network_sessions (
        id,
        player_id,
        proxy_server_id,
        proxy_server_instance_id,
        connected_at_ms
      )
      VALUES (
        ${networkSessionId}::uuid,
        ${player.playerId}::uuid,
        ${instance.serverId}::uuid,
        ${instance.id}::uuid,
        ${occurredAtMs}::bigint
      )
      RETURNING id
    `.execute(trx);

    await sql`
      UPDATE players
      SET last_seen_at_ms = ${occurredAtMs}::bigint,
          last_server_id = ${instance.serverId}::uuid
      WHERE id = ${player.playerId}::uuid
    `.execute(trx);

    const row = rows.rows[0];

    if (!row) {
      throw new Error("Network session insert did not return a row.");
    }

    return { closedSessions: closed.rows.map((closedRow) => ({ playerId: closedRow.player_id })) };
  }

  private async connectBackend(
    trx: DbExecutor,
    instance: InstanceIdentity,
    networkSessionId: string,
    backendServerId: string,
    backendServerInstanceId: string | null,
    occurredAtMs: string,
  ): Promise<string | null> {
    const validBackend = await sql<{ ok: number }>`
      SELECT 1 AS ok
      FROM servers backend
      LEFT JOIN server_instances bsi ON bsi.id = ${backendServerInstanceId}::uuid
      WHERE backend.id = ${backendServerId}::uuid
        AND backend.type <> 'velocity'
        AND (
          ${backendServerInstanceId}::uuid IS NULL
          OR (
            bsi.server_id = backend.id
            AND bsi.state IN ('active', 'draining')
          )
        )
      LIMIT 1
    `.execute(trx);

    if (!validBackend.rows[0]) {
      return null;
    }

    await sql`
      UPDATE backend_sessions
      SET left_at_ms = ${occurredAtMs}::bigint,
          leave_reason = 'transfer',
          updated_at_ms = get_unix_ms()
      WHERE network_session_id = ${networkSessionId}::uuid
        AND EXISTS (
          SELECT 1
          FROM network_sessions ns
          WHERE ns.id = ${networkSessionId}::uuid
            AND ns.proxy_server_instance_id = ${instance.id}::uuid
            AND ns.disconnected_at_ms IS NULL
        )
        AND left_at_ms IS NULL
    `.execute(trx);

    const rows = await sql<{ id: string }>`
      INSERT INTO backend_sessions (
        network_session_id,
        player_id,
        backend_server_id,
        backend_server_instance_id,
        joined_at_ms
      )
      SELECT
        ns.id,
        ns.player_id,
        ${backendServerId}::uuid,
        ${backendServerInstanceId}::uuid,
        ${occurredAtMs}::bigint
      FROM network_sessions ns
      WHERE ns.id = ${networkSessionId}::uuid
        AND ns.proxy_server_instance_id = ${instance.id}::uuid
        AND ns.disconnected_at_ms IS NULL
      RETURNING id
    `.execute(trx);

    const row = rows.rows[0];

    if (!row) {
      return null;
    }

    return row.id;
  }

  private async endNetworkSession(
    trx: DbExecutor,
    instance: InstanceIdentity,
    networkSessionId: string,
    occurredAtMs: string,
  ): Promise<Pick<SessionIdentity, "playerId">[]> {
    const rows = await sql<{ player_id: string }>`
      UPDATE network_sessions
      SET disconnected_at_ms = ${occurredAtMs}::bigint,
          disconnect_reason = 'disconnect',
          updated_at_ms = get_unix_ms()
      WHERE id = ${networkSessionId}::uuid
        AND proxy_server_instance_id = ${instance.id}::uuid
        AND disconnected_at_ms IS NULL
      RETURNING player_id
    `.execute(trx);

    return rows.rows.map((row) => ({ playerId: row.player_id }));
  }

  private async closeNetworkSessionsMissingFromPresence(
    trx: DbExecutor,
    proxyServerInstanceId: string,
    onlineMojangIds: string[],
    observedAtMs: string,
  ): Promise<{ count: number; sessions: Pick<SessionIdentity, "playerId">[] }> {
    const result = await sql<{ player_id: string }>`
      WITH closed AS (
        UPDATE network_sessions ns
        SET disconnected_at_ms = ${observedAtMs}::bigint,
            disconnect_reason = 'presence_absent',
            updated_at_ms = get_unix_ms()
        FROM players p
        WHERE p.id = ns.player_id
          AND ns.proxy_server_instance_id = ${proxyServerInstanceId}::uuid
          AND ns.disconnected_at_ms IS NULL
          AND ns.connected_at_ms <= ${observedAtMs}::bigint
          AND NOT (p.mojang_id = ANY(${onlineMojangIds}::uuid[]))
        RETURNING ns.player_id
      )
      SELECT player_id
      FROM closed
    `.execute(trx);

    return {
      count: result.rows.length,
      sessions: result.rows.map((row) => ({ playerId: row.player_id })),
    };
  }

  private async closeBackendSessionsMissingFromPresence(
    trx: DbExecutor,
    backendServerInstanceId: string,
    onlineMojangIds: string[],
    observedAtMs: string,
  ): Promise<{ count: number; sessions: Pick<SessionIdentity, "playerId">[] }> {
    const result = await sql<{ player_id: string }>`
      WITH closed AS (
        UPDATE backend_sessions bs
        SET left_at_ms = ${observedAtMs}::bigint,
            leave_reason = 'presence_absent',
            updated_at_ms = get_unix_ms()
        FROM players p
        WHERE p.id = bs.player_id
          AND bs.backend_server_instance_id = ${backendServerInstanceId}::uuid
          AND bs.left_at_ms IS NULL
          AND bs.joined_at_ms <= ${observedAtMs}::bigint
          AND NOT (p.mojang_id = ANY(${onlineMojangIds}::uuid[]))
        RETURNING bs.player_id
      )
      SELECT player_id
      FROM closed
    `.execute(trx);

    return {
      count: result.rows.length,
      sessions: result.rows.map((row) => ({ playerId: row.player_id })),
    };
  }

  private async closeProxyOwnedSessions(
    trx: DbExecutor,
    serverInstanceIds: string[],
    occurredAtMs: string,
    reason: string,
  ): Promise<Pick<SessionIdentity, "playerId">[]> {
    if (serverInstanceIds.length === 0) {
      return [];
    }

    const rows = await sql<{ player_id: string }>`
      UPDATE network_sessions
      SET disconnected_at_ms = ${occurredAtMs === "get_unix_ms()" ? sql`get_unix_ms()` : sql`${occurredAtMs}::bigint`},
          disconnect_reason = ${reason},
          updated_at_ms = get_unix_ms()
      WHERE proxy_server_instance_id IN (${sql.join(serverInstanceIds)})
        AND disconnected_at_ms IS NULL
      RETURNING player_id
    `.execute(trx);

    return rows.rows.map((row) => ({ playerId: row.player_id }));
  }

  private async closeBackendInstanceSessions(
    trx: DbExecutor,
    serverInstanceIds: string[],
    occurredAtMs: string,
    reason: string,
  ): Promise<Pick<SessionIdentity, "playerId">[]> {
    if (serverInstanceIds.length === 0) {
      return [];
    }

    const rows = await sql<{ player_id: string }>`
      UPDATE backend_sessions
      SET left_at_ms = ${occurredAtMs === "get_unix_ms()" ? sql`get_unix_ms()` : sql`${occurredAtMs}::bigint`},
          leave_reason = ${reason},
          updated_at_ms = get_unix_ms()
      WHERE backend_server_instance_id IN (${sql.join(serverInstanceIds)})
        AND left_at_ms IS NULL
      RETURNING player_id
    `.execute(trx);

    return rows.rows.map((row) => ({ playerId: row.player_id }));
  }

  private async lockActiveInstance(trx: DbExecutor, instance: InstanceIdentity): Promise<boolean> {
    const rows = await sql<{ id: string }>`
      SELECT id
      FROM server_instances
      WHERE id = ${instance.id}::uuid
        AND server_id = ${instance.serverId}::uuid
        AND state IN ('active', 'draining')
      FOR UPDATE
    `.execute(trx);

    return rows.rows.length > 0;
  }

  private async acceptPresenceSnapshot(
    trx: DbExecutor,
    serverInstanceId: string,
    snapshotSequence: string,
    observedAtMs: string,
  ): Promise<boolean> {
    const rows = await sql<{ id: string }>`
      UPDATE server_instances
      SET last_presence_sequence = ${snapshotSequence}::bigint,
          last_presence_observed_at_ms = ${observedAtMs}::bigint,
          updated_at_ms = get_unix_ms()
      WHERE id = ${serverInstanceId}::uuid
        AND (
          last_presence_sequence IS NULL
          OR last_presence_sequence < ${snapshotSequence}::bigint
          OR (
            last_presence_sequence = ${snapshotSequence}::bigint
            AND COALESCE(last_presence_observed_at_ms, 0) <= ${observedAtMs}::bigint
          )
        )
      RETURNING id
    `.execute(trx);

    return rows.rows.length > 0;
  }

  private async findObservedSessions(
    trx: DbExecutor,
    instance: InstanceIdentity,
    onlineMojangIds: string[],
  ): Promise<SessionIdentity[]> {
    if (onlineMojangIds.length === 0) {
      return [];
    }

    const rows =
      instance.serverType === "velocity"
        ? await sql<SessionIdentity>`
            SELECT
              p.actor_id AS "actorId",
              p.id AS "playerId",
              p.mojang_id AS "mojangId",
              ns.proxy_server_id AS "proxyServerId",
              ns.id AS "networkSessionId"
            FROM network_sessions ns
            INNER JOIN players p ON p.id = ns.player_id
            WHERE ns.proxy_server_instance_id = ${instance.id}::uuid
              AND ns.disconnected_at_ms IS NULL
              AND p.mojang_id = ANY(${onlineMojangIds}::uuid[])
          `.execute(trx)
        : await sql<SessionIdentity>`
            SELECT
              p.actor_id AS "actorId",
              p.id AS "playerId",
              p.mojang_id AS "mojangId",
              ns.proxy_server_id AS "proxyServerId",
              ns.id AS "networkSessionId"
            FROM backend_sessions bs
            INNER JOIN network_sessions ns ON ns.id = bs.network_session_id
            INNER JOIN players p ON p.id = ns.player_id
            WHERE bs.backend_server_instance_id = ${instance.id}::uuid
              AND bs.left_at_ms IS NULL
              AND ns.disconnected_at_ms IS NULL
              AND p.mojang_id = ANY(${onlineMojangIds}::uuid[])
          `.execute(trx);

    return rows.rows;
  }

  private async findActiveInstanceByBootId(
    trx: DbExecutor,
    serverId: string,
    bootId: string,
  ): Promise<ServerInstanceRow | null> {
    const rows = await sql<ServerInstanceRow>`
      SELECT
        si.id,
        si.server_id,
        s.type::text AS server_type,
        si.state::text,
        si.runtime_port,
        si.version,
        si.started_at_ms::text,
        si.draining_at_ms::text,
        si.stopped_at_ms::text,
        si.lost_at_ms::text,
        si.superseded_at_ms::text,
        si.last_heartbeat_at_ms::text,
        si.heartbeat_interval_ms::text,
        si.last_event_sequence::text,
        si.is_synthetic_backfill,
        si.created_at_ms::text,
        si.updated_at_ms::text
      FROM server_instances si
      INNER JOIN servers s ON s.id = si.server_id
      WHERE si.server_id = ${serverId}::uuid
        AND si.boot_id = ${bootId}
        AND si.state IN ('active', 'draining')
      LIMIT 1
    `.execute(trx);

    return rows.rows[0] ?? null;
  }
}

function isSessionEvent(type: string): boolean {
  return (
    type === "NETWORK_SESSION_STARTED" ||
    type === "BACKEND_CONNECTED" ||
    type === "NETWORK_SESSION_ENDED"
  );
}

function stringPayload(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function sessionIdentityPayload(value: unknown): SessionIdentity | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const payload = value as Record<string, unknown>;
  const actorId = stringPayload(payload.actorId);
  const playerId = stringPayload(payload.playerId);
  const mojangId = stringPayload(payload.mojangId);
  const proxyServerId = stringPayload(payload.proxyServerId);
  const networkSessionId = stringPayload(payload.networkSessionId);

  if (!actorId || !playerId || !mojangId || !proxyServerId || !networkSessionId) {
    return undefined;
  }

  return { actorId, playerId, mojangId, proxyServerId, networkSessionId };
}

function playerIdListPayload(value: unknown): Pick<SessionIdentity, "playerId">[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const playerId = stringPayload((entry as Record<string, unknown>).playerId);

    return playerId ? [{ playerId }] : [];
  });
}

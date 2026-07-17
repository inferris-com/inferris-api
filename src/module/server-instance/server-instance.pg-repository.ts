import { sql } from "kysely";

import type { DbExecutor } from "../../db/index.js";
import type {
  RegisterServerInstanceBody,
  ServerInstanceEventBody,
  ServerInstanceHeartbeatBody,
  ServerInstanceMetricsBody,
  ServerInstancePresenceBody,
} from "./server-instance.schemas.js";

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
  | { status: "created"; instance: ServerInstanceRow };

export type HeartbeatResult = {
  serverInstanceId: string;
  state: string;
  lastHeartbeatAtMs: string;
};

export type MetricsResult = {
  serverInstanceId: string;
  observationId: string;
  observedAtMs: string;
};

export type PresenceResult = {
  serverInstanceId: string;
  observedAtMs: string;
  observedPlayerCount: number;
};

export type EventResult =
  | {
      status: "processed" | "idempotent";
      serverInstanceId: string;
      eventId: string;
      sequence: string;
      type: string;
    }
  | { status: "sequence_gap"; expectedSequence: string }
  | { status: "conflict" }
  | { status: "forbidden" };

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

      await sql`
        WITH superseded AS (
          UPDATE server_instances
          SET state = 'superseded',
              superseded_at_ms = get_unix_ms(),
              updated_at_ms = get_unix_ms()
          WHERE server_id = ${input.serverId}::uuid
            AND state IN ('active', 'draining')
          RETURNING id
        )
        UPDATE server_instance_tokens sit
        SET revoked_at_ms = get_unix_ms(),
            revoked_reason = 'superseded'
        FROM superseded
        WHERE sit.server_instance_id = superseded.id
          AND sit.revoked_at_ms IS NULL
      `.execute(trx);

      const rows = await sql<ServerInstanceRow>`
        INSERT INTO server_instances (
          server_id,
          runtime_port,
          version,
          heartbeat_interval_ms,
          last_heartbeat_at_ms
        )
        VALUES (
          ${input.serverId}::uuid,
          ${input.runtimePort ?? null},
          ${input.version ?? null},
          ${input.heartbeatIntervalMs ?? null},
          get_unix_ms()
        )
        RETURNING
          id,
          server_id,
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
    const observedAtMs = input.observedAtMs ?? Date.now().toString();
    const rows = await sql<{
      id: string;
      state: string;
      last_heartbeat_at_ms: string;
    }>`
      UPDATE server_instances
      SET last_heartbeat_at_ms = ${observedAtMs}::bigint,
          heartbeat_interval_ms = COALESCE(${input.heartbeatIntervalMs ?? null}::bigint, heartbeat_interval_ms),
          runtime_port = ${input.runtimePort ?? null},
          version = COALESCE(${input.version ?? null}, version),
          updated_at_ms = get_unix_ms()
      WHERE id = ${instance.id}::uuid
        AND server_id = ${instance.serverId}::uuid
        AND state IN ('active', 'draining')
      RETURNING id, state::text, last_heartbeat_at_ms::text
    `.execute(this.db);

    const row = rows.rows[0];

    if (!row) {
      throw new Error("Server instance heartbeat did not update a row.");
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
    `.execute(this.db);

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
    `.execute(this.db);

    return {
      serverInstanceId: instance.id,
      observationId: observation.id,
      observedAtMs: observation.observed_at_ms,
    };
  }

  reconcilePresence(
    instance: InstanceIdentity,
    input: ServerInstancePresenceBody,
  ): PresenceResult {
    return {
      serverInstanceId: instance.id,
      observedAtMs: input.observedAtMs ?? Date.now().toString(),
      observedPlayerCount: input.onlineMojangIds.length,
    };
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
      }>`
        SELECT event_id, sequence::text, type::text, payload
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
          JSON.stringify(existingEvent.payload) === JSON.stringify(input.payload);

        return sameEvent
          ? {
              status: "idempotent",
              serverInstanceId: instance.id,
              eventId: input.eventId,
              sequence: input.sequence.toString(),
              type: input.type,
            }
          : { status: "conflict" };
      }

      const cursorRows = await sql<{ last_event_sequence: string }>`
        SELECT last_event_sequence::text
        FROM server_instances
        WHERE id = ${instance.id}::uuid
        FOR UPDATE
      `.execute(trx);
      const expectedSequence = Number(cursorRows.rows[0]?.last_event_sequence ?? "0") + 1;

      if (input.sequence !== expectedSequence) {
        return { status: "sequence_gap", expectedSequence: expectedSequence.toString() };
      }

      if (isSessionEvent(input.type) && instance.serverType !== "velocity") {
        return { status: "forbidden" };
      }

      const eventPayload = input.payload;
      const processingResult = await this.applyEvent(trx, instance, input, eventPayload, resolvePlayer);

      await sql`
        INSERT INTO server_events (
          server_instance_id,
          event_id,
          sequence,
          type,
          payload,
          processing_result
        )
        VALUES (
          ${instance.id}::uuid,
          ${input.eventId},
          ${input.sequence}::bigint,
          ${input.type}::server_event_type,
          ${JSON.stringify(eventPayload)}::jsonb,
          ${JSON.stringify(processingResult)}::jsonb
        )
      `.execute(trx);

      await sql`
        UPDATE server_instances
        SET last_event_sequence = ${input.sequence}::bigint,
            updated_at_ms = get_unix_ms()
        WHERE id = ${instance.id}::uuid
      `.execute(trx);

      return {
        status: "processed",
        serverInstanceId: instance.id,
        eventId: input.eventId,
        sequence: input.sequence.toString(),
        type: input.type,
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
      await this.markInstanceStopped(trx, instance, occurredAtMs);
      return { state: "stopped" };
    }

    if (input.type === "NETWORK_SESSION_STARTED") {
      const player = await resolvePlayer(payload);
      if (!player) {
        return { ignored: true, reason: "player_not_found" };
      }

      const networkSessionId = await this.startNetworkSession(trx, instance, player, occurredAtMs);
      return { networkSessionId };
    }

    if (input.type === "BACKEND_CONNECTED") {
      const player = await resolvePlayer(payload);
      const networkSessionId =
        stringPayload(payload.networkSessionId) ??
        (player ? await this.findCurrentNetworkSessionId(trx, player.playerId) : null);
      const backendServerId = stringPayload(payload.backendServerId);

      if (!networkSessionId || !backendServerId) {
        return { ignored: true, reason: "network_session_or_backend_missing" };
      }

      const backendSessionId = await this.connectBackend(
        trx,
        networkSessionId,
        backendServerId,
        stringPayload(payload.backendServerInstanceId),
        occurredAtMs,
      );

      return { networkSessionId, backendSessionId };
    }

    const player = await resolvePlayer(payload);
    const networkSessionId =
      stringPayload(payload.networkSessionId) ??
      (player ? await this.findCurrentNetworkSessionId(trx, player.playerId) : null);

    if (!networkSessionId) {
      return { ignored: true, reason: "network_session_missing" };
    }

    await this.endNetworkSession(trx, instance, networkSessionId, occurredAtMs);
    return { networkSessionId };
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
  ): Promise<void> {
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
      await this.closeProxyOwnedSessions(trx, instance.id, occurredAtMs, "proxy_stopped");
    } else {
      await this.closeBackendInstanceSessions(trx, instance.id, occurredAtMs, "backend_stopped");
    }
  }

  private async startNetworkSession(
    trx: DbExecutor,
    instance: InstanceIdentity,
    player: PlayerIdentity,
    occurredAtMs: string,
  ): Promise<string> {
    await sql`
      UPDATE network_sessions
      SET disconnected_at_ms = ${occurredAtMs}::bigint,
          disconnect_reason = 'replaced',
          updated_at_ms = get_unix_ms()
      WHERE player_id = ${player.playerId}::uuid
        AND disconnected_at_ms IS NULL
    `.execute(trx);

    const rows = await sql<{ id: string }>`
      INSERT INTO network_sessions (
        player_id,
        proxy_server_id,
        proxy_server_instance_id,
        connected_at_ms
      )
      VALUES (
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

    return row.id;
  }

  private async connectBackend(
    trx: DbExecutor,
    networkSessionId: string,
    backendServerId: string,
    backendServerInstanceId: string | null,
    occurredAtMs: string,
  ): Promise<string> {
    await sql`
      UPDATE backend_sessions
      SET left_at_ms = ${occurredAtMs}::bigint,
          leave_reason = 'transfer',
          updated_at_ms = get_unix_ms()
      WHERE network_session_id = ${networkSessionId}::uuid
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
        AND ns.disconnected_at_ms IS NULL
      RETURNING id
    `.execute(trx);

    const row = rows.rows[0];

    if (!row) {
      throw new Error("Backend session insert did not return a row.");
    }

    return row.id;
  }

  private async endNetworkSession(
    trx: DbExecutor,
    instance: InstanceIdentity,
    networkSessionId: string,
    occurredAtMs: string,
  ): Promise<void> {
    await sql`
      UPDATE network_sessions
      SET disconnected_at_ms = ${occurredAtMs}::bigint,
          disconnect_reason = 'disconnect',
          updated_at_ms = get_unix_ms()
      WHERE id = ${networkSessionId}::uuid
        AND proxy_server_instance_id = ${instance.id}::uuid
        AND disconnected_at_ms IS NULL
    `.execute(trx);
  }

  private async findCurrentNetworkSessionId(
    trx: DbExecutor,
    playerId: string,
  ): Promise<string | null> {
    const rows = await sql<{ network_session_id: string }>`
      SELECT network_session_id
      FROM network_sessions_current
      WHERE player_id = ${playerId}::uuid
      LIMIT 1
    `.execute(trx);

    return rows.rows[0]?.network_session_id ?? null;
  }

  private async closeProxyOwnedSessions(
    trx: DbExecutor,
    serverInstanceId: string,
    occurredAtMs: string,
    reason: string,
  ): Promise<void> {
    await sql`
      UPDATE network_sessions
      SET disconnected_at_ms = ${occurredAtMs}::bigint,
          disconnect_reason = ${reason},
          updated_at_ms = get_unix_ms()
      WHERE proxy_server_instance_id = ${serverInstanceId}::uuid
        AND disconnected_at_ms IS NULL
    `.execute(trx);
  }

  private async closeBackendInstanceSessions(
    trx: DbExecutor,
    serverInstanceId: string,
    occurredAtMs: string,
    reason: string,
  ): Promise<void> {
    await sql`
      UPDATE backend_sessions
      SET left_at_ms = ${occurredAtMs}::bigint,
          leave_reason = ${reason},
          updated_at_ms = get_unix_ms()
      WHERE backend_server_instance_id = ${serverInstanceId}::uuid
        AND left_at_ms IS NULL
    `.execute(trx);
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

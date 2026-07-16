import { sql } from "kysely";

import type { DbExecutor } from "../../db/index.js";
import type {
  MetricsOverviewResponse,
  NetworkMetricBucket,
  ServerMetricsResponse,
  ServerMetricBucket,
  ServerMetricSnapshot,
} from "./metrics.response-types.js";
import type { MetricsWindow } from "./metrics.schemas.js";

const bucketSizeMs = 60_000;
const staleAfterMs = 2 * 60_000;

type ServerSnapshotRow = {
  server_id: string;
  name: string;
  type: string;
  environment: string;
  status: string;
  last_heartbeat_at_ms: string | null;
  online_player_count: string | number;
  reported_online_player_count: string | number | null;
  max_players: string | number | null;
  tps_1m: string | number | null;
  tps_5m: string | number | null;
  tps_15m: string | number | null;
  mspt_avg: string | number | null;
  mspt_p95: string | number | null;
  heap_used_bytes: string | null;
  heap_max_bytes: string | null;
  loaded_chunks: string | number | null;
  loaded_worlds: string | number | null;
  backend_server_count: string | number | null;
};

type NetworkBucketRow = {
  bucket_start_ms: string;
  joins: string | number;
  disconnects: string | number;
  chat_messages: string | number;
  flagged_chat_messages: string | number;
};

type ServerBucketRow = NetworkBucketRow & {
  online_player_count: string | number | null;
  tps_1m: string | number | null;
  mspt_avg: string | number | null;
  heap_used_bytes: string | null;
};

type AverageSessionRow = {
  average_completed_session_seconds: string | number | null;
};

export class MetricsPgRepository {
  constructor(private readonly db: DbExecutor) {}

  async getOverview(window: MetricsWindow, windowMs: number): Promise<MetricsOverviewResponse> {
    const nowMs = Date.now();
    const startMs = nowMs - windowMs;
    const [servers, series, averageSession] = await Promise.all([
      this.listServerSnapshots(nowMs),
      this.listNetworkBuckets(startMs, nowMs),
      this.getAverageCompletedSessionSeconds(startMs, nowMs),
    ]);

    return {
      generatedAtMs: nowMs.toString(),
      window,
      current: {
        onlinePlayerCount: servers.reduce((total, server) => total + server.onlinePlayerCount, 0),
        serverCount: servers.length,
        onlineServerCount: servers.filter((server) => server.status === "online").length,
        staleServerCount: servers.filter((server) => server.isStale).length,
        averageCompletedSessionSeconds: averageSession,
      },
      servers,
      series,
    };
  }

  async getServerMetrics(
    serverId: string,
    window: MetricsWindow,
    windowMs: number,
  ): Promise<ServerMetricsResponse | null> {
    const nowMs = Date.now();
    const startMs = nowMs - windowMs;
    const server = await this.getServerSnapshot(serverId, nowMs);

    if (!server) {
      return null;
    }

    return {
      generatedAtMs: nowMs.toString(),
      window,
      server,
      series: await this.listServerBuckets(serverId, startMs, nowMs),
    };
  }

  private async listServerSnapshots(nowMs: number): Promise<ServerMetricSnapshot[]> {
    const rows = await sql<ServerSnapshotRow>`
      SELECT
        s.id AS server_id,
        s.name,
        s.type::text AS type,
        s.environment::text AS environment,
        s.status::text AS status,
        s.last_heartbeat_at_ms::text,
        count(c.player_id)::int AS online_player_count,
        lm.online_player_count AS reported_online_player_count,
        lm.max_players,
        lm.tps_1m,
        lm.tps_5m,
        lm.tps_15m,
        lm.mspt_avg,
        lm.mspt_p95,
        lm.heap_used_bytes::text,
        lm.heap_max_bytes::text,
        lm.loaded_chunks,
        lm.loaded_worlds,
        lm.backend_server_count
      FROM servers s
      LEFT JOIN player_sessions_current c ON c.server_id = s.id
      LEFT JOIN server_latest_metrics lm ON lm.server_id = s.id
      GROUP BY s.id, lm.server_id
      ORDER BY s.environment ASC, s.type ASC, s.name ASC
    `.execute(this.db);

    return rows.rows.map((row) => toServerSnapshot(row, nowMs));
  }

  private async getServerSnapshot(
    serverId: string,
    nowMs: number,
  ): Promise<ServerMetricSnapshot | null> {
    const rows = await sql<ServerSnapshotRow>`
      SELECT
        s.id AS server_id,
        s.name,
        s.type::text AS type,
        s.environment::text AS environment,
        s.status::text AS status,
        s.last_heartbeat_at_ms::text,
        count(c.player_id)::int AS online_player_count,
        lm.online_player_count AS reported_online_player_count,
        lm.max_players,
        lm.tps_1m,
        lm.tps_5m,
        lm.tps_15m,
        lm.mspt_avg,
        lm.mspt_p95,
        lm.heap_used_bytes::text,
        lm.heap_max_bytes::text,
        lm.loaded_chunks,
        lm.loaded_worlds,
        lm.backend_server_count
      FROM servers s
      LEFT JOIN player_sessions_current c ON c.server_id = s.id
      LEFT JOIN server_latest_metrics lm ON lm.server_id = s.id
      WHERE s.id = ${serverId}::uuid
      GROUP BY s.id, lm.server_id
    `.execute(this.db);

    const row = rows.rows[0];
    return row ? toServerSnapshot(row, nowMs) : null;
  }

  private async listNetworkBuckets(startMs: number, nowMs: number): Promise<NetworkMetricBucket[]> {
    const rows = await sql<NetworkBucketRow>`
      WITH buckets AS (
        SELECT generate_series(
          ${bucketStart(startMs)}::bigint,
          ${bucketStart(nowMs)}::bigint,
          ${bucketSizeMs}::bigint
        ) AS bucket_start_ms
      ),
      joins AS (
        SELECT floor(connected_at_ms / ${bucketSizeMs})::bigint * ${bucketSizeMs} AS bucket_start_ms,
               count(*)::int AS count
        FROM player_session_events
        WHERE connected_at_ms >= ${startMs}::bigint
          AND connected_at_ms <= ${nowMs}::bigint
        GROUP BY 1
      ),
      disconnects AS (
        SELECT floor(disconnected_at_ms / ${bucketSizeMs})::bigint * ${bucketSizeMs} AS bucket_start_ms,
               count(*)::int AS count
        FROM player_session_events
        WHERE disconnected_at_ms IS NOT NULL
          AND disconnected_at_ms >= ${startMs}::bigint
          AND disconnected_at_ms <= ${nowMs}::bigint
        GROUP BY 1
      ),
      chat AS (
        SELECT floor(created_at_ms / ${bucketSizeMs})::bigint * ${bucketSizeMs} AS bucket_start_ms,
               count(*)::int AS count,
               count(*) FILTER (WHERE is_flagged)::int AS flagged_count
        FROM chat_messages
        WHERE created_at_ms >= ${startMs}::bigint
          AND created_at_ms <= ${nowMs}::bigint
        GROUP BY 1
      )
      SELECT
        b.bucket_start_ms::text,
        coalesce(j.count, 0)::int AS joins,
        coalesce(d.count, 0)::int AS disconnects,
        coalesce(c.count, 0)::int AS chat_messages,
        coalesce(c.flagged_count, 0)::int AS flagged_chat_messages
      FROM buckets b
      LEFT JOIN joins j USING (bucket_start_ms)
      LEFT JOIN disconnects d USING (bucket_start_ms)
      LEFT JOIN chat c USING (bucket_start_ms)
      ORDER BY b.bucket_start_ms ASC
    `.execute(this.db);

    return rows.rows.map(toNetworkBucket);
  }

  private async listServerBuckets(
    serverId: string,
    startMs: number,
    nowMs: number,
  ): Promise<ServerMetricBucket[]> {
    const rows = await sql<ServerBucketRow>`
      WITH buckets AS (
        SELECT generate_series(
          ${bucketStart(startMs)}::bigint,
          ${bucketStart(nowMs)}::bigint,
          ${bucketSizeMs}::bigint
        ) AS bucket_start_ms
      ),
      observations AS (
        SELECT floor(observed_at_ms / ${bucketSizeMs})::bigint * ${bucketSizeMs} AS bucket_start_ms,
               max(online_player_count)::int AS online_player_count,
               avg(tps_1m) AS tps_1m,
               avg(mspt_avg) AS mspt_avg,
               max(heap_used_bytes)::text AS heap_used_bytes
        FROM server_heartbeat_observations
        WHERE server_id = ${serverId}::uuid
          AND observed_at_ms >= ${startMs}::bigint
          AND observed_at_ms <= ${nowMs}::bigint
        GROUP BY 1
      ),
      joins AS (
        SELECT floor(connected_at_ms / ${bucketSizeMs})::bigint * ${bucketSizeMs} AS bucket_start_ms,
               count(*)::int AS count
        FROM player_session_events
        WHERE server_id = ${serverId}::uuid
          AND connected_at_ms >= ${startMs}::bigint
          AND connected_at_ms <= ${nowMs}::bigint
        GROUP BY 1
      ),
      disconnects AS (
        SELECT floor(disconnected_at_ms / ${bucketSizeMs})::bigint * ${bucketSizeMs} AS bucket_start_ms,
               count(*)::int AS count
        FROM player_session_events
        WHERE server_id = ${serverId}::uuid
          AND disconnected_at_ms IS NOT NULL
          AND disconnected_at_ms >= ${startMs}::bigint
          AND disconnected_at_ms <= ${nowMs}::bigint
        GROUP BY 1
      ),
      chat AS (
        SELECT floor(created_at_ms / ${bucketSizeMs})::bigint * ${bucketSizeMs} AS bucket_start_ms,
               count(*)::int AS count,
               count(*) FILTER (WHERE is_flagged)::int AS flagged_count
        FROM chat_messages
        WHERE origin_server_id = ${serverId}::uuid
          AND created_at_ms >= ${startMs}::bigint
          AND created_at_ms <= ${nowMs}::bigint
        GROUP BY 1
      )
      SELECT
        b.bucket_start_ms::text,
        coalesce(j.count, 0)::int AS joins,
        coalesce(d.count, 0)::int AS disconnects,
        coalesce(c.count, 0)::int AS chat_messages,
        coalesce(c.flagged_count, 0)::int AS flagged_chat_messages,
        o.online_player_count,
        o.tps_1m,
        o.mspt_avg,
        o.heap_used_bytes
      FROM buckets b
      LEFT JOIN observations o USING (bucket_start_ms)
      LEFT JOIN joins j USING (bucket_start_ms)
      LEFT JOIN disconnects d USING (bucket_start_ms)
      LEFT JOIN chat c USING (bucket_start_ms)
      ORDER BY b.bucket_start_ms ASC
    `.execute(this.db);

    return rows.rows.map(toServerBucket);
  }

  private async getAverageCompletedSessionSeconds(
    startMs: number,
    nowMs: number,
  ): Promise<number | null> {
    const rows = await sql<AverageSessionRow>`
      SELECT avg((disconnected_at_ms - connected_at_ms) / 1000.0)
        AS average_completed_session_seconds
      FROM player_session_events
      WHERE disconnected_at_ms IS NOT NULL
        AND connected_at_ms >= ${startMs}::bigint
        AND connected_at_ms <= ${nowMs}::bigint
    `.execute(this.db);

    return nullableNumber(rows.rows[0]?.average_completed_session_seconds);
  }
}

function toServerSnapshot(row: ServerSnapshotRow, nowMs: number): ServerMetricSnapshot {
  const lastHeartbeatAtMs = row.last_heartbeat_at_ms;
  const heartbeatAgeMs = lastHeartbeatAtMs === null ? null : nowMs - Number(lastHeartbeatAtMs);

  return {
    serverId: row.server_id,
    name: row.name,
    type: row.type,
    environment: row.environment,
    status: row.status,
    lastHeartbeatAtMs,
    heartbeatAgeMs,
    isStale: heartbeatAgeMs === null || heartbeatAgeMs > staleAfterMs,
    onlinePlayerCount: numberValue(row.online_player_count),
    reportedOnlinePlayerCount: nullableNumber(row.reported_online_player_count),
    maxPlayers: nullableNumber(row.max_players),
    tps1m: nullableNumber(row.tps_1m),
    tps5m: nullableNumber(row.tps_5m),
    tps15m: nullableNumber(row.tps_15m),
    msptAvg: nullableNumber(row.mspt_avg),
    msptP95: nullableNumber(row.mspt_p95),
    heapUsedBytes: row.heap_used_bytes,
    heapMaxBytes: row.heap_max_bytes,
    loadedChunks: nullableNumber(row.loaded_chunks),
    loadedWorlds: nullableNumber(row.loaded_worlds),
    backendServerCount: nullableNumber(row.backend_server_count),
  };
}

function toNetworkBucket(row: NetworkBucketRow): NetworkMetricBucket {
  return {
    bucketStartMs: row.bucket_start_ms,
    joins: numberValue(row.joins),
    disconnects: numberValue(row.disconnects),
    chatMessages: numberValue(row.chat_messages),
    flaggedChatMessages: numberValue(row.flagged_chat_messages),
  };
}

function toServerBucket(row: ServerBucketRow): ServerMetricBucket {
  return {
    ...toNetworkBucket(row),
    onlinePlayerCount: nullableNumber(row.online_player_count),
    tps1m: nullableNumber(row.tps_1m),
    msptAvg: nullableNumber(row.mspt_avg),
    heapUsedBytes: row.heap_used_bytes,
  };
}

function bucketStart(value: number): number {
  return Math.floor(value / bucketSizeMs) * bucketSizeMs;
}

function numberValue(value: string | number): number {
  return typeof value === "number" ? value : Number(value);
}

function nullableNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  return numberValue(value);
}

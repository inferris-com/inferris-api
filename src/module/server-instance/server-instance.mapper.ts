import type { ServerInstanceRow } from "@/module/server-instance/server-instance.pg-repository.js";
import type { ServerInstanceResponse } from "@/module/server-instance/server-instance.response-types.js";

export function toServerInstanceResponse(row: ServerInstanceRow): ServerInstanceResponse {
  return {
    id: row.id,
    serverId: row.server_id,
    state: row.state,
    runtimePort: row.runtime_port,
    version: row.version,
    startedAtMs: row.started_at_ms,
    drainingAtMs: row.draining_at_ms,
    stoppedAtMs: row.stopped_at_ms,
    lostAtMs: row.lost_at_ms,
    supersededAtMs: row.superseded_at_ms,
    lastHeartbeatAtMs: row.last_heartbeat_at_ms,
    heartbeatIntervalMs: row.heartbeat_interval_ms,
    lastEventSequence: row.last_event_sequence,
    isSyntheticBackfill: row.is_synthetic_backfill,
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms,
  };
}

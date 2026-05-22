import type { Selectable } from "kysely";
import type { ServerAccessPolicies, Lockdowns, Servers } from "../../db/types.js";
import type {AccessResponse, LockdownResponse, ServerResponse} from "./server.response.types.js";
import { int8ToString, int8ToStringOrDefault } from "../../shared/db/int8.js";

export function toServerResponse(servers: Selectable<Servers>): ServerResponse{
  return {
    id: servers.id,
    name: servers.name,
    type: servers.type,
    environment: servers.environment,
    status: servers.status,
    port: servers.port,
    version: servers.version,

    lastStartedAtMs: int8ToString(servers.last_started_at_ms),
    lastHeartbeatAtMs: int8ToString(servers.last_heartbeat_at_ms),

    createdAtMs: int8ToStringOrDefault(servers.created_at_ms, "0"),
    lastUpdatedAtMs: int8ToString(servers.last_updated_at_ms)
  }
}

export function toAccessResponse(access: Selectable<ServerAccessPolicies>): AccessResponse{
  return {
    id: access.server_id,
    mode: access.mode,
    note: access.note,
    requiredPermissionId: access.required_permission_id ? access.required_permission_id : null,
    requiredRankKey: access.required_rank_key ? access.required_rank_key : null,
    createdAtMs: access.created_at_ms,
    updatedAtMs: access.updated_at_ms ? access.updated_at_ms : null,
  }
}

export function toLockdownResponse(lockdown: Selectable<Lockdowns>): LockdownResponse {
  return {
    id: lockdown.id,
    scope: lockdown.scope,
    serverId: lockdown.server_id ? lockdown.server_id : null,
    requiredRankKey: lockdown.required_rank_key,
    reason: lockdown.reason,
    issuedByActorId: lockdown.issued_by_actor_id,
    isActive: lockdown.is_active,
    startedAtMs: lockdown.starts_at_ms,
    endsAtMs: lockdown.ends_at_ms ? lockdown.ends_at_ms : null
  }
}

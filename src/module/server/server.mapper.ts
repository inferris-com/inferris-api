import type { Selectable, Updateable } from "kysely";
import type { Lockdowns, ServerAccessPolicies, Servers } from "../../db/types.js";
import type { AccessResponse, LockdownResponse, ServerResponse } from "./server.response.types.js";
import { int8ToStringOrDefault, int8ToStringOrNull } from "../../shared/db/int8.js";
import type { ReplaceServerAccessBody, UpdateLockdownBody } from "./server.schemas.js";

export type ServerWithPresence = Selectable<Servers> & {
  status?: "online" | "offline";
};

export function toServerResponse(servers: ServerWithPresence): ServerResponse {
  return {
    id: servers.id,
    name: servers.name,
    type: servers.type,
    environment: servers.environment,
    status: servers.status ?? "offline",
    port: servers.port,

    createdAtMs: int8ToStringOrDefault(servers.created_at_ms, "0"),
    lastUpdatedAtMs: int8ToStringOrNull(servers.last_updated_at_ms),
  };
}

export function toAccessResponse(access: Selectable<ServerAccessPolicies>): AccessResponse {
  return {
    id: access.server_id,
    mode: access.mode,
    note: access.note,
    requiredPermissionId: access.required_permission_id ? access.required_permission_id : null,
    requiredRankKey: access.required_rank_key ? access.required_rank_key : null,
    createdAtMs: access.created_at_ms,
    updatedAtMs: access.updated_at_ms ? access.updated_at_ms : null,
  };
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
    endsAtMs: lockdown.ends_at_ms ? lockdown.ends_at_ms : null,
  };
}

export function toServerAccessPolicyUpdate(
  input: ReplaceServerAccessBody,
): Updateable<ServerAccessPolicies> {
  return {
    mode: input.mode,
    required_permission_id: input.requiredPermissionId,
    required_rank_key: input.requiredRankKey,
    note: input.note,
  };
}

export function toServerLockdownUpdate(input: UpdateLockdownBody): Updateable<Lockdowns> {
  return {
    required_rank_key: input.requiredRankKey,
    scope: input.scope,
    reason: input.reason,
    is_active: input.isActive,
    starts_at_ms: input.startsAtMs,
    ends_at_ms: input.endsAtMs,
  };
}

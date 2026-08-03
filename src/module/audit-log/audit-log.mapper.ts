import type { Selectable } from "kysely";

import type { AuditLogs } from "@/db/types.js";

export function toAuditLogResponse(row: Selectable<AuditLogs>) {
  return {
    id: row.id,
    requestId: row.request_id,
    actorId: row.actor_id,
    subjectActorId: row.subject_actor_id,
    principalType: row.principal_type,
    principalId: row.principal_id,
    platform: row.platform,
    source: row.source,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    result: row.result,
    reason: row.reason,
    metadata: row.metadata,
    createdAtMs: row.created_at_ms,
  };
}

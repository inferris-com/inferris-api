import type { Selectable } from "kysely";

import type { ModCaseActors, ModCases } from "../../db/types.js";
import { int8ToString, int8ToStringOrNull } from "../../shared/db/int8.js";
import type { ModCaseActorResponse, ModCaseResponse } from "./mod-case.response-types.js";

export function toModCaseResponse(row: Selectable<ModCases>): ModCaseResponse {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    openedByActorId: row.opened_by_actor_id,
    assignedToActorId: row.assigned_to_actor_id,
    closedByActorId: row.closed_by_actor_id,
    originServerId: row.origin_server_id,
    status: row.status,
    severity: row.severity,
    resolution: row.resolution,
    isSticky: row.is_sticky,
    openedAtMs: int8ToString(row.opened_at_ms),
    closedAtMs: int8ToStringOrNull(row.closed_at_ms),
    updatedAtMs: int8ToStringOrNull(row.updated_at_ms),
  };
}

export function toModCaseActorResponse(row: Selectable<ModCaseActors>): ModCaseActorResponse {
  return {
    id: row.id,
    caseId: row.case_id,
    actorId: row.actor_id,
    role: row.role,
    addedByActorId: row.added_by_actor_id,
    addedAtMs: int8ToString(row.added_at_ms),
    note: row.note,
  };
}

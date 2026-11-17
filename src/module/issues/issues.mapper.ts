import type { Selectable } from "kysely";
import type { Issues } from "@/db/types.js";
import type { IssueResponse } from "@/module/issues/issues.response-types.js";

export function toIssueResponse(row: Selectable<Issues>): IssueResponse {
  return {
    id: row.id,
    platform: row.platform,
    title: row.title,
    description: row.description,
    status: row.status,
    severity: row.severity ?? null,
    createdByActorId: row.created_by_actor_id,
    assignedToActorId: row.assigned_to_actor_id ?? null,
    closedByActorId: row.closed_by_actor_id ?? null,
    closedAtMs: row.closed_at_ms ?? null,
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms ?? null,
  };
}

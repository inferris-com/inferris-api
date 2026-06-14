import type { Selectable } from "kysely";

import type { ReportComments, Reports } from "../../db/types.js";
import { int8ToString, int8ToStringOrNull } from "../../shared/db/int8.js";
import type { ReportCommentResponse, ReportResponse } from "./report.response-types.js";

export function toReportResponse(row: Selectable<Reports>): ReportResponse {
  return {
    id: row.id,
    reporterActorId: row.reporter_actor_id,
    subjectActorId: row.subject_actor_id,
    selectedReason: row.selected_reason,
    reasonDescription: row.reason_description,
    status: row.status,
    severity: row.severity,
    resolution: row.resolution,
    originServerId: row.origin_server_id,
    assignedToActorId: row.assigned_to_actor_id,
    triagedByActorId: row.triaged_by_actor_id,
    triagedAtMs: int8ToStringOrNull(row.triaged_at_ms),
    closedByActorId: row.closed_by_actor_id,
    closedAtMs: int8ToStringOrNull(row.closed_at_ms),
    resolutionNote: row.resolution_note,
    createdAtMs: int8ToString(row.created_at_ms),
    updatedAtMs: int8ToStringOrNull(row.updated_at_ms),
  };
}

export function toReportCommentResponse(row: Selectable<ReportComments>): ReportCommentResponse {
  return {
    id: row.id,
    reportId: row.report_id,
    authorActorId: row.author_actor_id,
    parentCommentId: row.parent_comment_id,
    commentText: row.comment_text,
    isSticky: row.is_sticky,
    createdAtMs: int8ToString(row.created_at_ms),
    editedAtMs: int8ToStringOrNull(row.edited_at_ms),
  };
}

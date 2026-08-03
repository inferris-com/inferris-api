import type { Selectable } from "kysely";

import type { ReportComments, Reports } from "@/db/types.js";
import { int8ToString, int8ToStringOrNull } from "@/shared/db/int8.js";
import type {
  ReportCommentResponse,
  ReportResponse,
} from "@/module/report/report.response-types.js";

export function toReportResponse(row: Selectable<Reports>): ReportResponse {
  return {
    id: row.id,
    code: row.code,
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
  const isDeleted = row.deleted_at_ms !== null;

  return {
    id: row.id,
    reportId: row.report_id,
    authorActorId: row.author_actor_id,
    authorArgusUserId: row.author_argus_user_id,
    parentCommentId: row.parent_comment_id,
    commentText: isDeleted ? null : row.comment_text,
    isSticky: isDeleted ? false : row.is_sticky,
    isDeleted,
    createdAtMs: int8ToString(row.created_at_ms),
    editedAtMs: int8ToStringOrNull(row.edited_at_ms),
    deletedAtMs: int8ToStringOrNull(row.deleted_at_ms),
    deletedByActorId: row.deleted_by_actor_id,
    deletedByArgusUserId: row.deleted_by_argus_user_id,
  };
}

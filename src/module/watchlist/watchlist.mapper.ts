import type { WatchlistEntryResponse } from "./watchlist.response-types.js";

export type WatchlistEntryRecord = {
  id: number;
  subject_actor_id: string;
  subject_player_id: string | null;
  subject_username: string | null;
  added_by_actor_id: string;
  reason: string | null;
  severity: "low" | "medium" | "high" | "critical" | null;
  alert_on_join: boolean;
  alert_on_chat: boolean;
  alert_note: string | null;
  expires_at_ms: string | null;
  cleared_by_actor_id: string | null;
  cleared_at_ms: string | null;
  added_at_ms: string;
  updated_at_ms: string | null;
};

export function toWatchlistEntryResponse(row: WatchlistEntryRecord): WatchlistEntryResponse {
  return {
    id: row.id,
    subjectActorId: row.subject_actor_id,
    subjectPlayerId: row.subject_player_id,
    subjectUsername: row.subject_username,
    addedByActorId: row.added_by_actor_id,
    reason: row.reason,
    severity: row.severity,
    alertOnJoin: row.alert_on_join,
    alertOnChat: row.alert_on_chat,
    alertNote: row.alert_note,
    expiresAtMs: row.expires_at_ms,
    clearedByActorId: row.cleared_by_actor_id,
    clearedAtMs: row.cleared_at_ms,
    addedAtMs: row.added_at_ms,
    updatedAtMs: row.updated_at_ms,
  };
}

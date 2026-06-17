export type WatchlistEntryResponse = {
  id: number;
  subjectActorId: string;
  subjectPlayerId: string | null;
  subjectUsername: string | null;
  addedByActorId: string;
  reason: string | null;
  severity: "low" | "medium" | "high" | "critical" | null;
  alertOnJoin: boolean;
  alertOnChat: boolean;
  alertNote: string | null;
  expiresAtMs: string | null;
  clearedByActorId: string | null;
  clearedAtMs: string | null;
  addedAtMs: string;
  updatedAtMs: string | null;
};

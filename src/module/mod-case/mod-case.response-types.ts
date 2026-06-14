import type {
  ModCaseResolution,
  ModCaseStatus,
  ModerationCaseActorRole,
  Severity,
} from "../../db/types.js";

export type ModCaseResponse = {
  id: string;
  title: string;
  description: string | null;
  openedByActorId: string;
  assignedToActorId: string | null;
  closedByActorId: string | null;
  originServerId: string | null;
  status: ModCaseStatus;
  severity: Severity | null;
  resolution: ModCaseResolution | null;
  isSticky: boolean;
  openedAtMs: string;
  closedAtMs: string | null;
  updatedAtMs: string | null;
};

export type ModCaseActorResponse = {
  id: string;
  caseId: string;
  actorId: string;
  role: ModerationCaseActorRole;
  addedByActorId: string | null;
  addedAtMs: string;
  note: string | null;
};

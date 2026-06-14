import type { ReportResolution, ReportStatus, Severity } from "../../db/types.js";

export type ReportResponse = {
  id: string;
  reporterActorId: string;
  subjectActorId: string;
  selectedReason: string;
  reasonDescription: string | null;
  status: ReportStatus;
  severity: Severity | null;
  resolution: ReportResolution | null;
  originServerId: string | null;
  assignedToActorId: string | null;
  triagedByActorId: string | null;
  triagedAtMs: string | null;
  closedByActorId: string | null;
  closedAtMs: string | null;
  resolutionNote: string | null;
  createdAtMs: string;
  updatedAtMs: string | null;
};

export type ReportCommentResponse = {
  id: string;
  reportId: string;
  authorActorId: string;
  parentCommentId: string | null;
  commentText: string;
  isSticky: boolean;
  createdAtMs: string;
  editedAtMs: string | null;
};

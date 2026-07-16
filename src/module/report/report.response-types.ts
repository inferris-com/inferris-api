import type { ReportResolution, ReportStatus, Severity } from "../../db/types.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

extendZodWithOpenApi(z);

export const reportResponseSchema = z
  .object({
    id: z.string().uuid(),
    code: z.string().regex(/^[A-Z0-9]{8,12}$/),
    reporterActorId: z.string().uuid(),
    subjectActorId: z.string().uuid(),
    selectedReason: z.string(),
    reasonDescription: z.string().nullable(),
    status: z.enum(["actioned", "dismissed", "duplicate", "open", "under_review"]),
    severity: z.enum(["critical", "high", "low", "medium"]).nullable(),
    resolution: z
      .enum([
        "action_taken",
        "duplicate",
        "escalated_to_case",
        "false_report",
        "insufficient_evidence",
        "no_action",
        "resolved_elsewhere",
      ])
      .nullable(),
    originServerId: z.string().uuid().nullable(),
    assignedToActorId: z.string().uuid().nullable(),
    triagedByActorId: z.string().uuid().nullable(),
    triagedAtMs: z.string().nullable(),
    closedByActorId: z.string().uuid().nullable(),
    closedAtMs: z.string().nullable(),
    resolutionNote: z.string().nullable(),
    createdAtMs: z.string(),
    updatedAtMs: z.string().nullable(),
  })
  .openapi("ReportResponse");

export const reportCommentResponseSchema = z
  .object({
    id: z.string().uuid(),
    reportId: z.string().uuid(),
    authorActorId: z.string().uuid(),
    authorArgusUserId: z.string().uuid().nullable(),
    parentCommentId: z.string().uuid().nullable(),
    commentText: z.string().nullable(),
    isSticky: z.boolean(),
    isDeleted: z.boolean(),
    createdAtMs: z.string(),
    editedAtMs: z.string().nullable(),
    deletedAtMs: z.string().nullable(),
    deletedByActorId: z.string().uuid().nullable(),
    deletedByArgusUserId: z.string().uuid().nullable(),
  })
  .openapi("ReportCommentResponse");

export type ReportResponse = z.infer<typeof reportResponseSchema> & {
  status: ReportStatus;
  severity: Severity | null;
  resolution: ReportResolution | null;
};

export type ReportCommentResponse = z.infer<typeof reportCommentResponseSchema>;

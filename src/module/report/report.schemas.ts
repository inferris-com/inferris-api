import z from "zod";

import { paginationQuerySchema } from "@/shared/pagination.schemas.js";

export const reportStatusSchema = z.enum([
  "open",
  "under_review",
  "actioned",
  "dismissed",
  "duplicate",
]);
export const reportResolutionSchema = z.enum([
  "action_taken",
  "insufficient_evidence",
  "no_action",
  "escalated_to_case",
  "false_report",
  "duplicate",
]);
export const severitySchema = z.enum(["low", "medium", "high", "critical"]);

export const reportIdParamsSchema = z.object({
  reportId: z.guid({ message: "Invalid report UUID format." }),
});

export const reportCodeSchema = z
  .string()
  .regex(/^[A-Z0-9]{8,12}$/, "Report code must be 8-12 uppercase letters or digits.");

export const reportCodeParamsSchema = z.object({
  code: reportCodeSchema,
});

export const reportCommentIdParamsSchema = reportIdParamsSchema.extend({
  commentId: z.guid({ message: "Invalid report comment UUID format." }),
});

export const createReportBodySchema = z
  .object({
    reporterActorId: z.guid().optional(),
    reporterPlayerId: z.guid().optional(),
    subjectActorId: z.guid().optional(),
    subjectPlayerId: z.guid().optional(),
    selectedReason: z.string().min(1).max(100),
    reasonDescription: z.string().max(4000).optional().nullable(),
    originServerId: z.guid().optional().nullable(),
  })
  .strict()
  .refine((body) => Boolean(body.reporterActorId) !== Boolean(body.reporterPlayerId), {
    message: "Provide exactly one of reporterActorId or reporterPlayerId.",
    path: ["reporterActorId"],
  })
  .refine((body) => Boolean(body.subjectActorId) !== Boolean(body.subjectPlayerId), {
    message: "Provide exactly one of subjectActorId or subjectPlayerId.",
    path: ["subjectActorId"],
  });

export const listReportsQuerySchema = paginationQuerySchema
  .extend({
    reporterActorId: z.guid().optional(),
    subjectActorId: z.guid().optional(),
    assignedToActorId: z.guid().optional(),
    originServerId: z.guid().optional(),
    status: reportStatusSchema.optional(),
    severity: severitySchema.optional(),
    selectedReason: z.string().min(1).max(100).optional(),
  })
  .strict();

export const updateReportBodySchema = z
  .object({
    status: reportStatusSchema.optional(),
    severity: severitySchema.optional().nullable(),
    assignedToActorId: z.guid().optional().nullable(),
    resolution: reportResolutionSchema.optional().nullable(),
    resolutionNote: z.string().max(4000).optional().nullable(),
  })
  .strict();

export const createReportCommentBodySchema = z
  .object({
    parentCommentId: z.guid().optional().nullable(),
    commentText: z.string().min(1).max(4000),
    isSticky: z.boolean().optional().default(false),
  })
  .strict();

export const updateReportCommentBodySchema = z
  .object({
    commentText: z.string().min(1).max(4000),
    isSticky: z.boolean().optional(),
  })
  .strict();

export type ReportIdParams = z.infer<typeof reportIdParamsSchema>;
export type ReportCodeParams = z.infer<typeof reportCodeParamsSchema>;
export type ReportCommentIdParams = z.infer<typeof reportCommentIdParamsSchema>;
export type CreateReportBody = z.infer<typeof createReportBodySchema>;
export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>;
export type UpdateReportBody = z.infer<typeof updateReportBodySchema>;
export type CreateReportCommentBody = z.infer<typeof createReportCommentBodySchema>;
export type UpdateReportCommentBody = z.infer<typeof updateReportCommentBodySchema>;

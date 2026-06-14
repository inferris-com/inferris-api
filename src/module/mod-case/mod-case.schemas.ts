import z from "zod";

import { paginationQuerySchema } from "../../shared/pagination.schemas.js";

export const modCaseStatusSchema = z.enum([
  "open",
  "investigating",
  "pending_action",
  "resolved",
  "dismissed",
  "closed",
]);
export const modCaseResolutionSchema = z.enum([
  "action_taken",
  "insufficient_evidence",
  "no_action",
  "monitoring",
  "referred",
  "duplicate",
  "invalid",
  "resolved_elsewhere",
]);
export const moderationCaseActorRoleSchema = z.enum([
  "subject",
  "reporter",
  "victim",
  "witness",
  "suspected_alt",
  "related_actor",
  "assigned_mod",
  "reviewer",
]);
export const severitySchema = z.enum(["low", "medium", "high", "critical"]);

export const modCaseIdParamsSchema = z.object({
  caseId: z.guid({ message: "Invalid mod case UUID format." }),
});

export const createModCaseActorBodySchema = z
  .object({
    actorId: z.guid(),
    role: moderationCaseActorRoleSchema,
    note: z.string().max(2000).optional().nullable(),
  })
  .strict();

export const createModCaseBodySchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(4000).optional().nullable(),
    assignedToActorId: z.guid().optional().nullable(),
    originServerId: z.guid().optional().nullable(),
    severity: severitySchema.optional().nullable(),
    isSticky: z.boolean().optional().default(false),
    relatedReportId: z.guid().optional().nullable(),
    actors: z.array(createModCaseActorBodySchema).max(25).optional().default([]),
  })
  .strict();

export const listModCasesQuerySchema = paginationQuerySchema
  .extend({
    openedByActorId: z.guid().optional(),
    assignedToActorId: z.guid().optional(),
    originServerId: z.guid().optional(),
    status: modCaseStatusSchema.optional(),
    severity: severitySchema.optional(),
  })
  .strict();

export const updateModCaseBodySchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(4000).optional().nullable(),
    assignedToActorId: z.guid().optional().nullable(),
    status: modCaseStatusSchema.optional(),
    severity: severitySchema.optional().nullable(),
    resolution: modCaseResolutionSchema.optional().nullable(),
    isSticky: z.boolean().optional(),
  })
  .strict();

export type ModCaseIdParams = z.infer<typeof modCaseIdParamsSchema>;
export type CreateModCaseActorBody = z.infer<typeof createModCaseActorBodySchema>;
export type CreateModCaseBody = z.infer<typeof createModCaseBodySchema>;
export type ListModCasesQuery = z.infer<typeof listModCasesQuerySchema>;
export type UpdateModCaseBody = z.infer<typeof updateModCaseBodySchema>;

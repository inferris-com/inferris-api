import type {
  ModCaseResolution,
  ModCaseStatus,
  ModerationCaseActorRole,
  Severity,
} from "@/db/types.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

extendZodWithOpenApi(z);

export const modCaseResponseSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    description: z.string().nullable(),
    openedByActorId: z.string().uuid(),
    openedByArgusUserId: z.string().uuid().nullable(),
    assignedToActorId: z.string().uuid().nullable(),
    assignedToArgusUserId: z.string().uuid().nullable(),
    closedByActorId: z.string().uuid().nullable(),
    closedByArgusUserId: z.string().uuid().nullable(),
    originServerId: z.string().uuid().nullable(),
    status: z.enum(["closed", "dismissed", "investigating", "open", "pending_action", "resolved"]),
    severity: z.enum(["critical", "high", "low", "medium"]).nullable(),
    resolution: z
      .enum([
        "action_taken",
        "duplicate",
        "insufficient_evidence",
        "invalid",
        "monitoring",
        "no_action",
        "referred",
        "resolved_elsewhere",
      ])
      .nullable(),
    isSticky: z.boolean(),
    openedAtMs: z.string(),
    closedAtMs: z.string().nullable(),
    updatedAtMs: z.string().nullable(),
  })
  .openapi("ModCaseResponse");

export const modCaseActorResponseSchema = z
  .object({
    id: z.string().uuid(),
    caseId: z.string().uuid(),
    actorId: z.string().uuid(),
    role: z.enum([
      "assigned_mod",
      "related_actor",
      "reporter",
      "reviewer",
      "subject",
      "suspected_alt",
      "victim",
      "witness",
    ]),
    addedByActorId: z.string().uuid().nullable(),
    addedAtMs: z.string(),
    note: z.string().nullable(),
  })
  .openapi("ModCaseActorResponse");

export type ModCaseResponse = z.infer<typeof modCaseResponseSchema> & {
  status: ModCaseStatus;
  severity: Severity | null;
  resolution: ModCaseResolution | null;
};

export type ModCaseActorResponse = z.infer<typeof modCaseActorResponseSchema> & {
  role: ModerationCaseActorRole;
};

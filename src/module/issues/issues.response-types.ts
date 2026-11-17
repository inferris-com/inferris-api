import z from "zod";
import { issueSeverity, issueStatus } from "@/module/issues/issues.schemas.js";
import { BigIntStringSchema, PlatformSchema } from "@/shared/common.schemas.js";

export const issueResponseSchema = z
  .object({
    id: z.guid(),
    platform: PlatformSchema,
    title: z.string().min(3).max(255),
    description: z.string().min(1).max(1000),
    status: issueStatus,
    severity: issueSeverity.nullable(),
    createdByActorId: z.guid(),
    assignedToActorId: z.guid().nullable(),
    closedByActorId: z.guid().nullable(),
    closedAtMs: BigIntStringSchema.nullable(), // string
    createdAtMs: BigIntStringSchema, // string
    updatedAtMs: BigIntStringSchema.nullable(), // string
  })
  .strict()
  .openapi("IssueResponse");

export type IssueResponse = z.infer<typeof issueResponseSchema>;

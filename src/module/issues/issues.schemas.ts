import z from "zod";
import { PlatformSchema } from "@/shared/common.schemas.js";
import { paginationQuerySchema } from "@/shared/pagination.schemas.js";

export const issueStatus = z.enum([
  "open",
  "reviewing",
  "confirmed",
  "in_progress",
  "resolved",
  "duplicate",
  "invalid",
  "closed",
]);
export const issueSeverity = z.enum(["low", "medium", "high", "critical"]);
export const terminalIssueStatuses = ["resolved", "duplicate", "invalid", "closed"] as const;
export function isTerminalIssueStatus(status: IssueStatus): boolean {
  return terminalIssueStatuses.some((value) => value === status);
}
export const issueParamsSchema = z.object({ id: z.guid() }).strict();
const fields = {
  platform: PlatformSchema,
  title: z.string().trim().min(3).max(255),
  description: z.string().trim().min(1).max(1000).nullable(),
  status: issueStatus,
  severity: issueSeverity.nullable(),
};
export const createIssueSchema = z
  .object({
    ...fields,
    description: fields.description.default("No description"),
    status: issueStatus.default("open"),
    severity: fields.severity.default(null),
  })
  .strict();
export const updateIssueSchema = z
  .object({
    ...fields,
    assignedToActorId: z.guid().nullable(),
  })
  .partial()
  .strict()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "At least one field must be provided",
  });
export const listIssuesQuerySchema = paginationQuerySchema
  .extend({
    platform: PlatformSchema.optional(),
    status: issueStatus.optional(),
    severity: issueSeverity.optional(),
    createdByActorId: z.guid().optional(),
    assignedToActorId: z.guid().optional(),
    search: z.string().trim().min(1).max(255).optional(),
  })
  .strict();
export type IssueParams = z.infer<typeof issueParamsSchema>;
export type CreateIssueBody = z.infer<typeof createIssueSchema>;
export type UpdateIssueBody = z.infer<typeof updateIssueSchema>;
export type ListIssuesQuery = z.infer<typeof listIssuesQuerySchema>;
export type IssueStatus = z.infer<typeof issueStatus>;
export type IssueSeverity = z.infer<typeof issueSeverity>;

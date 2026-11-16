import z from "zod";

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

const createIssueSchema = z
  .object({
    // id auto-generated
    platform: z.enum(["minecraft", "argus", "discord", "other"]),
    title: z.string().min(3).max(255),
    description: z.string().min(1).max(1000).nullable().default("No description"),
    status: issueStatus,
    severity: issueSeverity,

    // actor id creator = middleware; omitted
  })
  .strict();

const updateIssueSchema = z
  .object({
    // id auto-generated
    platform: z.enum(["minecraft", "argus", "discord", "other"]).optional(),
    title: z.string().min(3).max(255).optional(),
    description: z.string().min(1).max(1000).nullable().default("No description").optional(),
    status: issueStatus.optional(),
    severity: issueSeverity.optional(),
    assignedToActorId: z.uuid().optional().nullable(),
    closedByActorId: z.uuid().optional().nullable(),
  })
  .strict()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "At least one field must be provided",
  })
  .superRefine((data, ctx) => {
    if (data.status !== undefined && data.status !== "closed" && data.closedByActorId != null) {
      ctx.addIssue({
        code: "custom",
        path: ["closedByActorId"],
        message: "Only closed issues can have a closing actor",
      });
    }
  });

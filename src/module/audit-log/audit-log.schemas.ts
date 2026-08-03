import z from "zod";

import { paginationQuerySchema } from "@/shared/pagination.schemas.js";

export const auditLogParamsSchema = z.object({ auditLogId: z.string().uuid() }).strict();

export const listAuditLogsQuerySchema = paginationQuerySchema
  .extend({
    actorId: z.string().uuid().optional(),
    subjectActorId: z.string().uuid().optional(),
    principalType: z
      .enum([
        "argus_user",
        "minecraft_session",
        "server_api_key",
        "service_actor_api_key",
        "user_api_key",
        "discord_bot",
        "internal_worker",
        "system",
        "unknown",
      ])
      .optional(),
    platform: z.enum(["minecraft", "discord", "argus", "bot", "other"]).optional(),
    action: z.string().trim().min(1).max(200).optional(),
    targetType: z.string().trim().min(1).max(100).optional(),
    result: z.enum(["allowed", "denied", "failed"]).optional(),
  })
  .strict();

export type AuditLogParams = z.infer<typeof auditLogParamsSchema>;
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;

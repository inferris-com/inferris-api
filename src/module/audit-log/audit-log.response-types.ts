import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import type { Json, Platform, PrincipalType } from "../../db/types.js";

extendZodWithOpenApi(z);

export const auditLogResponseSchema = z
  .object({
    id: z.string().uuid(),
    requestId: z.string().uuid().nullable(),
    actorId: z.string().uuid().nullable(),
    subjectActorId: z.string().uuid().nullable(),
    principalType: z.string().nullable(),
    principalId: z.string().uuid().nullable(),
    platform: z.string().nullable(),
    source: z.string().nullable(),
    action: z.string(),
    targetType: z.string().nullable(),
    targetId: z.string().uuid().nullable(),
    result: z.string(),
    reason: z.string().nullable(),
    metadata: z.any().nullable(),
    createdAtMs: z.string(),
  })
  .openapi("AuditLogResponse");

export type AuditLogResponse = {
  id: string;
  requestId: string | null;
  actorId: string | null;
  subjectActorId: string | null;
  principalType: PrincipalType | null;
  principalId: string | null;
  platform: Platform | null;
  source: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  result: string;
  reason: string | null;
  metadata: Json | null;
  createdAtMs: string;
};

import z from "zod";

import { BigIntStringSchema } from "../../shared/common.schemas.js";
import { paginationQuerySchema } from "../../shared/pagination.schemas.js";

export const punishmentTypeSchema = z.enum(["ban", "mute", "warn", "kick"]);

export const punishmentIdParamsSchema = z.object({
  punishmentId: z.guid({ message: "Invalid punishment UUID format." }),
});

export const listPunishmentsQuerySchema = paginationQuerySchema
  .extend({
    subjectActorId: z.guid().optional(),
    subjectPlayerId: z.guid().optional(),
    issuerActorId: z.guid().optional(),
    serverOriginId: z.guid().optional(),
    type: punishmentTypeSchema.optional(),
    active: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => (value === undefined ? undefined : value === "true")),
    revoked: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => (value === undefined ? undefined : value === "true")),
  })
  .strict();

export const createPunishmentBodySchema = z
  .object({
    subjectActorId: z.guid().optional(),
    subjectPlayerId: z.guid().optional(),
    serverOriginId: z.guid().optional().nullable(),
    type: punishmentTypeSchema,
    reason: z.string().max(1000).optional().nullable(),
    isSilent: z.boolean().optional().default(false),
    endsAtMs: BigIntStringSchema.optional().nullable(),
  })
  .strict()
  .refine((body) => Boolean(body.subjectActorId) !== Boolean(body.subjectPlayerId), {
    message: "Provide exactly one of subjectActorId or subjectPlayerId.",
    path: ["subjectActorId"],
  });

export const revokePunishmentBodySchema = z
  .object({
    reason: z.string().max(50).optional().nullable(),
  })
  .strict();

export type PunishmentIdParams = z.infer<typeof punishmentIdParamsSchema>;
export type ListPunishmentsQuery = z.infer<typeof listPunishmentsQuerySchema>;
export type CreatePunishmentBody = z.infer<typeof createPunishmentBodySchema>;
export type RevokePunishmentBody = z.infer<typeof revokePunishmentBodySchema>;

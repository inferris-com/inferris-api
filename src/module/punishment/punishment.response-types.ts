import type { Punishment, PunishmentLiftedCause } from "../../db/types.js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

extendZodWithOpenApi(z);

export const punishmentResponseSchema = z
  .object({
    id: z.string().uuid(),
    code: z.string().regex(/^[A-Z0-9]{8,12}$/),
    subjectActorId: z.string().uuid(),
    issuerActorId: z.string().uuid(),
    serverOriginId: z.string().uuid().nullable(),
    type: z.enum(["ban", "kick", "mute", "warn"]),
    reason: z.string().nullable(),
    isSilent: z.boolean(),
    isActive: z.boolean(),
    endsAtMs: z.string().nullable(),
    note: z.string().nullable(),
    liftedCause: z.enum(["appeal_accepted", "expired", "revoked"]).nullable(),
    liftedAtMs: z.string().nullable(),
    liftedByActorId: z.string().uuid().nullable(),
    liftNote: z.string().nullable(),
    createdAtMs: z.string(),
    updatedAtMs: z.string().nullable(),
  })
  .openapi("PunishmentResponse");

export type PunishmentResponse = z.infer<typeof punishmentResponseSchema> & {
  type: Punishment;
  liftedCause: PunishmentLiftedCause | null;
};

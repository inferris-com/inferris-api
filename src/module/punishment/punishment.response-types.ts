import type { Punishment } from "../../db/types.js";

export type PunishmentResponse = {
  id: string;
  subjectActorId: string;
  issuerActorId: string;
  serverOriginId: string | null;
  type: Punishment;
  reason: string | null;
  isSilent: boolean;
  isActive: boolean;
  endsAtMs: string | null;
  revokedByActorId: string | null;
  revokedAtMs: string | null;
  revocationReason: string | null;
  createdAtMs: string;
  updatedAtMs: string | null;
};

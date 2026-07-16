import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import type { Json } from "../../db/types.js";

extendZodWithOpenApi(z);

export const playerSessionResponseSchema = z
  .object({
    id: z.string().uuid(),
    playerId: z.string().uuid(),
    playerUsername: z.string(),
    playerMojangId: z.string().uuid(),
    actorId: z.string().uuid(),
    serverId: z.string().uuid(),
    serverName: z.string(),
    isLive: z.boolean(),
    connectedAtMs: z.string(),
    disconnectedAtMs: z.string().nullable(),
    disconnectReason: z.string().nullable(),
    meta: z.any(),
    updatedAtMs: z.string().nullable(),
  })
  .openapi("PlayerSessionDetailsResponse");

export type PlayerSessionResponse = {
  id: string;
  playerId: string;
  playerUsername: string;
  playerMojangId: string;
  actorId: string;
  serverId: string;
  serverName: string;
  isLive: boolean;
  connectedAtMs: string;
  disconnectedAtMs: string | null;
  disconnectReason: string | null;
  meta: Json;
  updatedAtMs: string | null;
};

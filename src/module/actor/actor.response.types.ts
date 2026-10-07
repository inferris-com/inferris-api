import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

extendZodWithOpenApi(z);

export const actorResponseSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().nullable(),
    type: z.enum(["system", "application", "user", "unspecified"]),
    playerId: z.string().uuid().nullable(),
    createdAtMs: z.string(),
    lastUpdatedAtMs: z.string().nullable(),
  })
  .openapi("ActorResponse");

export type ActorResponse = z.infer<typeof actorResponseSchema>;

export const actorSummaryResponseSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().nullable(),
    type: z.enum(["system", "application", "user", "unspecified"]),
    player: z
      .object({
        id: z.string().uuid(),
        username: z.string(),
        activeNickname: z
          .object({
            nickname: z.string(),
            coverRankKey: z.string().nullable(),
          })
          .nullable(),
      })
      .nullable()
      .describe("Active player identity only. Archived players fall back to the actor label."),
  })
  .openapi("ActorSummaryResponse");

export type ActorSummaryResponse = z.infer<typeof actorSummaryResponseSchema>;

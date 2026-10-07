import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

import { actorSummaryResponseSchema } from "@/module/actor/actor.response.types.js";

extendZodWithOpenApi(z);

export const chatMessageResponseSchema = z
  .object({
    id: z.string().uuid(),
    producerMessageId: z.string(),
    ingestStreamId: z.string().nullable(),
    actorId: z.string().uuid(),
    playerId: z.string().uuid().nullable(),
    originServerId: z.string().uuid(),
    channelKey: z.string(),
    message: z.string(),
    verdict: z.enum(["allow", "warn", "deny"]),
    moderationReason: z.string().nullable(),
    moderationMetadata: z.unknown(),
    isFlagged: z.boolean(),
    occurredAtMs: z.string(),
    persistenceState: z.enum(["pending", "persisted"]),
  })
  .openapi("ChatMessageResponse");

export const chatMessageListItemResponseSchema = chatMessageResponseSchema
  .extend({
    actor: actorSummaryResponseSchema.nullable().optional(),
  })
  .openapi("ChatMessageListItemResponse");

export const chatMessageListResponseSchema = z
  .object({
    data: z.array(chatMessageListItemResponseSchema),
    meta: z.object({
      count: z.number().int(),
      limit: z.number().int(),
      includePending: z.boolean(),
      nextCursor: z.string().nullable(),
    }),
  })
  .openapi("ChatMessageListResponse");

export type ChatMessageResponse = z.infer<typeof chatMessageResponseSchema>;
export type ChatMessageListItemResponse = z.infer<typeof chatMessageListItemResponseSchema>;

import z from "zod";

import { config } from "../../config.js";

const boolQuerySchema = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((value) => (typeof value === "boolean" ? value : value === "true"));

export const messageVerdictSchema = z.enum(["allow", "warn", "deny"]);

export const createChatMessageBodySchema = z
  .object({
    producerMessageId: z.string().min(1).max(200),
    actorId: z.guid().optional(),
    playerId: z.guid().optional(),
    originServerId: z.guid(),
    channelKey: z.string().min(1).max(30).default("global"),
    message: z.string().min(1).max(4000),
    occurredAtMs: z.string().optional(),
    verdict: messageVerdictSchema.default("allow"),
    moderationReason: z.string().max(4000).optional().nullable(),
    moderationMetadata: z.record(z.string(), z.unknown()).optional().default({}),
    isFlagged: z.boolean().optional().default(false),
  })
  .strict()
  .refine((body) => Boolean(body.actorId) !== Boolean(body.playerId), {
    message: "Provide exactly one of actorId or playerId.",
    path: ["actorId"],
  });

export const createChatMessageBatchBodySchema = z
  .object({
    messages: z.array(createChatMessageBodySchema).min(1).max(config.chat.maxBatchSize),
  })
  .strict();

export const listChatMessagesQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(500).default(100),
    beforeMs: z.string().optional(),
    afterMs: z.string().optional(),
    channelKey: z.string().min(1).max(30).optional(),
    originServerId: z.guid().optional(),
    actorId: z.guid().optional(),
    playerId: z.guid().optional(),
    verdict: messageVerdictSchema.optional(),
    includePending: boolQuerySchema.default(true),
  })
  .strict()
  .refine(
    (query) =>
      query.beforeMs === undefined ||
      query.afterMs === undefined ||
      query.afterMs <= query.beforeMs,
    {
      message: "afterMs must be less than or equal to beforeMs.",
      path: ["afterMs"],
    },
  );

export type CreateChatMessageBody = z.infer<typeof createChatMessageBodySchema>;
export type CreateChatMessageBatchBody = z.infer<typeof createChatMessageBatchBodySchema>;
export type ListChatMessagesQuery = z.infer<typeof listChatMessagesQuerySchema>;

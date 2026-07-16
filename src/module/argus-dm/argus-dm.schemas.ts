import z from "zod";

import { paginationQuerySchema } from "../../shared/pagination.schemas.js";

export const argusDmConversationParamsSchema = z
  .object({
    conversationId: z.guid({ message: "Invalid Argus DM conversation UUID format." }),
  })
  .strict();

export const argusDmMessageParamsSchema = argusDmConversationParamsSchema
  .extend({
    messageId: z.guid({ message: "Invalid Argus DM message UUID format." }),
  })
  .strict();

export const listArgusDmConversationsQuerySchema = paginationQuerySchema.strict();

export const createArgusDmConversationBodySchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    recipientArgusUserIds: z.array(z.guid()).min(1).max(50),
    body: z.string().trim().min(1).max(10000).optional(),
  })
  .strict();

export const updateArgusDmConversationBodySchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    addRecipientArgusUserIds: z.array(z.guid()).min(1).max(50).optional(),
  })
  .strict()
  .refine((body) => body.title !== undefined || body.addRecipientArgusUserIds !== undefined, {
    message: "Provide a title or recipients to add.",
  });

export const createArgusDmMessageBodySchema = z
  .object({
    body: z.string().trim().min(1).max(10000),
  })
  .strict();

export const updateArgusDmMessageBodySchema = z
  .object({
    body: z.string().trim().min(1).max(10000),
  })
  .strict();

export type ArgusDmConversationParams = z.infer<typeof argusDmConversationParamsSchema>;
export type ArgusDmMessageParams = z.infer<typeof argusDmMessageParamsSchema>;
export type ListArgusDmConversationsQuery = z.infer<typeof listArgusDmConversationsQuerySchema>;
export type CreateArgusDmConversationBody = z.infer<typeof createArgusDmConversationBodySchema>;
export type UpdateArgusDmConversationBody = z.infer<typeof updateArgusDmConversationBodySchema>;
export type CreateArgusDmMessageBody = z.infer<typeof createArgusDmMessageBodySchema>;
export type UpdateArgusDmMessageBody = z.infer<typeof updateArgusDmMessageBodySchema>;

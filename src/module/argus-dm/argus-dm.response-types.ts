import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

extendZodWithOpenApi(z);

export const argusDmParticipantResponseSchema = z
  .object({
    argusUserId: z.string().uuid(),
    username: z.string(),
    role: z.enum(["moderator", "admin"]),
    invitedByArgusUserId: z.string().uuid().nullable(),
    joinedAtMs: z.string(),
  })
  .openapi("ArgusDmParticipantResponse");

export const argusDmConversationResponseSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    ownerArgusUserId: z.string().uuid().nullable(),
    participants: z.array(argusDmParticipantResponseSchema),
    latestMessage: z
      .object({
        id: z.string().uuid(),
        authorArgusUserId: z.string().uuid().nullable(),
        body: z.string().nullable(),
        isDeleted: z.boolean(),
        createdAtMs: z.string(),
      })
      .nullable(),
    createdAtMs: z.string(),
    updatedAtMs: z.string().nullable(),
  })
  .openapi("ArgusDmConversationResponse");

export const argusDmMessageResponseSchema = z
  .object({
    id: z.string().uuid(),
    conversationId: z.string().uuid(),
    authorArgusUserId: z.string().uuid().nullable(),
    body: z.string().nullable(),
    isDeleted: z.boolean(),
    createdAtMs: z.string(),
    editedAtMs: z.string().nullable(),
    deletedAtMs: z.string().nullable(),
    deletedByArgusUserId: z.string().uuid().nullable(),
  })
  .openapi("ArgusDmMessageResponse");

export type ArgusDmParticipantResponse = z.infer<typeof argusDmParticipantResponseSchema>;
export type ArgusDmConversationResponse = z.infer<typeof argusDmConversationResponseSchema>;
export type ArgusDmMessageResponse = z.infer<typeof argusDmMessageResponseSchema>;

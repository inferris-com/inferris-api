import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import z from "zod";

import { accountRoleSchema } from "../account/account.schemas.js";

extendZodWithOpenApi(z);

export const argusDmParticipantResponseSchema = z
  .object({
    argusUserId: z.string().uuid(),
    username: z.string(),
    role: accountRoleSchema,
    invitedByArgusUserId: z.string().uuid().nullable(),
    joinedAtMs: z.string(),
    lastReadAtMs: z.string().nullable(),
  })
  .openapi("ArgusDmParticipantResponse");

export const argusDmConversationResponseSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    ownerArgusUserId: z.string().uuid().nullable(),
    participants: z.array(argusDmParticipantResponseSchema),
    isUnread: z.boolean(),
    unreadMessageCount: z.number().int().min(0),
    lastReadAtMs: z.string().nullable(),
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

export const argusDmUnreadCountResponseSchema = z
  .object({
    unreadConversations: z.number().int().min(0),
  })
  .openapi("ArgusDmUnreadCountResponse");

export type ArgusDmParticipantResponse = z.infer<typeof argusDmParticipantResponseSchema>;
export type ArgusDmConversationResponse = z.infer<typeof argusDmConversationResponseSchema>;
export type ArgusDmMessageResponse = z.infer<typeof argusDmMessageResponseSchema>;
export type ArgusDmUnreadCountResponse = z.infer<typeof argusDmUnreadCountResponseSchema>;
